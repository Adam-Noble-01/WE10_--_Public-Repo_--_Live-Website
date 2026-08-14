#!/usr/bin/env python3
# =============================================================================
# NOBLE BIM ASSET TOOLS | LOCAL SERVER - REVIT TO IFC CONVERSION BROKER
# =============================================================================
#
# FILE       : Na__LocalServer__RevitConvert__.py
# NAMESPACE  : Na__BimAssetTools
# MODULE     : LocalServer - RevitConvert
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Run the DDC RVT2IFC converter on behalf of the browser
# CREATED    : 14-Aug-2026
#
# DESCRIPTION:
# - A browser page cannot launch a local executable, and it should not be able to.
#   The application therefore hands the file to this local server, which brokers
#   the conversion and hands back the resulting IFC.
# - Conversion of a real project file takes tens of seconds, so it runs on a
#   background thread against a job id that the browser polls. A silent minute
#   with no feedback is not acceptable in an interactive tool.
#
# ---------------------------------------------------------------------------
#
# CONVERTER COMMAND LINE:
#
#     RVT2IFCconverter.exe "<input.rvt>" "<output.ifc>" [mode=custom Param=Value ...]
#
# The bare three-argument form is used by default. It emits IFC4 Reference View
# in millimetres, which is exactly what the IFC loader wants, so there is no
# reason to pass custom parameters unless a specific view filter is needed.
# Progress is written to stdout as "Progress: NN.NN%" lines, which are parsed
# here and surfaced to the browser.
#
# ---------------------------------------------------------------------------
#
# SECURITY POSTURE:
# This endpoint runs an executable on uploaded bytes, so it is deliberately
# constrained:
#   - The server binds to 127.0.0.1 only. It is not reachable off the machine.
#   - The client filename is never used as a path. Only its basename survives,
#     stripped to a safe character set, so "../../" cannot escape the job folder.
#   - Every job gets its own temporary directory, removed when the job is reaped.
#   - The converter path is resolved from a fixed allow-list of known locations,
#     never from anything the client sends.
#
# =============================================================================

import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid

# =============================================================================
# REGION | Converter Location
# =============================================================================

_MODULE_DIRECTORY = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT     = os.path.dirname(_MODULE_DIRECTORY)

# Candidate locations, most preferred first. The vendored copy wins so the tool
# is self contained; the original studio location is kept as a fallback because
# the vendored tree is large enough that it is git-ignored by default.
CONVERTER_CANDIDATES = [
    os.path.join(
        _PROJECT_ROOT,
        "04__Src__Dependencies__VersionLocked",
        "04__Vendor__DdcRvt2Ifc__v18.1.0",
        "DDC_REVIT2IFC_CONVERTER",
        "RVT2IFCconverter.exe",
    ),
    r"D:\02_CoreLib__SketchUp\30__Software__3dSoftware__Tools&Utils"
    r"\3dTool__Tool__RevitToIfc__Converter\DDC_Converter_Revit2IFC_v05032026"
    r"\DDC_REVIT2IFC_CONVERTER\RVT2IFCconverter.exe",
]

CONVERTIBLE_EXTENSIONS = {".rvt", ".rfa", ".rte", ".rft"}

# A large project file legitimately takes minutes. Past this it is considered hung.
CONVERSION_TIMEOUT_SECONDS = 900

# Finished jobs are kept this long so the browser can still collect the result.
JOB_RETENTION_SECONDS = 1800


# -----------------------------------------------------------------------------
# FUNCTION | Locate the Converter Executable
# -----------------------------------------------------------------------------
def Na__RevitConvert__FindConverter():
    for candidate in CONVERTER_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
    return None

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Job Registry
# =============================================================================

_JOBS      = {}
_JOBS_LOCK = threading.Lock()


# -----------------------------------------------------------------------------
# FUNCTION | Reduce a Client Filename to a Safe Basename
# -----------------------------------------------------------------------------
def Na__RevitConvert__SafeName(raw_name):
    # Only the basename survives, so a path in the client name cannot escape the
    # job directory. Everything outside a conservative character set is replaced.
    base = os.path.basename(raw_name or "").strip()
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    base = base.lstrip(".") or "model.rvt"

    stem, extension = os.path.splitext(base)
    if extension.lower() not in CONVERTIBLE_EXTENSIONS:
        extension = ".rvt"
    return f"{(stem or 'model')[:120]}{extension}"


# -----------------------------------------------------------------------------
# FUNCTION | Update a Job Record Under Lock
# -----------------------------------------------------------------------------
def Na__RevitConvert__UpdateJob(job_id, **changes):
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if job is not None:
            job.update(changes)


# -----------------------------------------------------------------------------
# FUNCTION | Read a Job Record Under Lock
# -----------------------------------------------------------------------------
def Na__RevitConvert__GetJob(job_id):
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        return dict(job) if job else None


# -----------------------------------------------------------------------------
# FUNCTION | Remove Jobs Past Their Retention Window
# -----------------------------------------------------------------------------
def Na__RevitConvert__ReapOldJobs():
    now = time.time()
    expired = []

    with _JOBS_LOCK:
        for job_id, job in list(_JOBS.items()):
            if job["state"] in ("completed", "failed") and (now - job["updatedAt"]) > JOB_RETENTION_SECONDS:
                expired.append(_JOBS.pop(job_id))

    for job in expired:
        shutil.rmtree(job["workDirectory"], ignore_errors=True)

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Conversion Worker
# =============================================================================

_PROGRESS_PATTERN = re.compile(r"Progress:\s*([0-9]+(?:\.[0-9]+)?)%")


# -----------------------------------------------------------------------------
# FUNCTION | Run the Converter and Track Its Progress
# -----------------------------------------------------------------------------
def Na__RevitConvert__RunConversion(job_id):
    job            = Na__RevitConvert__GetJob(job_id)
    converter_path = Na__RevitConvert__FindConverter()

    if not converter_path:
        Na__RevitConvert__UpdateJob(
            job_id, state="failed", updatedAt=time.time(),
            message="The DDC RVT2IFC converter was not found in any known location.",
        )
        return

    input_path  = job["inputPath"]
    output_path = os.path.splitext(input_path)[0] + ".ifc"

    Na__RevitConvert__UpdateJob(
        job_id, state="running", percent=0.0, updatedAt=time.time(),
        message="Starting converter...", outputPath=output_path,
    )

    try:
        # The converter is a Qt application. Without a console window flag it can
        # pop a window on some systems, so it is started detached from any console.
        creation_flags = 0
        if os.name == "nt":
            creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

        process = subprocess.Popen(
            [converter_path, input_path, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=os.path.dirname(converter_path),   # Qt plugins resolve relative to the exe
            text=True,
            bufsize=1,
            creationflags=creation_flags,
        )

        started_at   = time.time()
        tail_lines   = []

        for line in process.stdout:
            line = line.strip()
            if not line:
                continue

            tail_lines.append(line)
            if len(tail_lines) > 40:
                tail_lines.pop(0)

            match = _PROGRESS_PATTERN.search(line)
            if match:
                Na__RevitConvert__UpdateJob(
                    job_id, percent=float(match.group(1)), updatedAt=time.time(),
                    message="Converting geometry...",
                )
            elif "Successfully exported" in line:
                Na__RevitConvert__UpdateJob(job_id, message="Writing IFC...", updatedAt=time.time())

            if (time.time() - started_at) > CONVERSION_TIMEOUT_SECONDS:
                process.kill()
                raise TimeoutError(f"Conversion exceeded {CONVERSION_TIMEOUT_SECONDS} seconds and was stopped.")

        exit_code = process.wait()

        if exit_code != 0:
            raise RuntimeError(f"Converter exited with code {exit_code}. Last output: {' | '.join(tail_lines[-5:])}")

        if not os.path.isfile(output_path):
            raise RuntimeError(f"Converter reported success but wrote no IFC. Last output: {' | '.join(tail_lines[-5:])}")

        size_bytes = os.path.getsize(output_path)
        if size_bytes == 0:
            raise RuntimeError("Converter produced an empty IFC file.")

        Na__RevitConvert__UpdateJob(
            job_id, state="completed", percent=100.0, updatedAt=time.time(),
            message="Conversion complete.", outputBytes=size_bytes,
            outputName=os.path.basename(output_path),
        )

    except Exception as error:
        Na__RevitConvert__UpdateJob(
            job_id, state="failed", updatedAt=time.time(), message=str(error),
        )

# endregion -------------------------------------------------------------------


# =============================================================================
# REGION | Public Job API
# =============================================================================

# -----------------------------------------------------------------------------
# FUNCTION | Queue a Conversion and Return Its Job Id
# -----------------------------------------------------------------------------
def Na__RevitConvert__StartJob(file_bytes, client_file_name):
    Na__RevitConvert__ReapOldJobs()

    if not Na__RevitConvert__FindConverter():
        raise FileNotFoundError("The DDC RVT2IFC converter is not installed in any known location.")

    safe_name      = Na__RevitConvert__SafeName(client_file_name)
    job_id         = uuid.uuid4().hex
    work_directory = tempfile.mkdtemp(prefix=f"na_rvt2ifc_{job_id[:8]}_")
    input_path     = os.path.join(work_directory, safe_name)

    with open(input_path, "wb") as handle:
        handle.write(file_bytes)

    with _JOBS_LOCK:
        _JOBS[job_id] = {
            "jobId"         : job_id,
            "state"         : "queued",
            "percent"       : 0.0,
            "message"       : "Queued.",
            "sourceName"    : safe_name,
            "inputPath"     : input_path,
            "outputPath"    : None,
            "outputName"    : None,
            "outputBytes"   : 0,
            "workDirectory" : work_directory,
            "createdAt"     : time.time(),
            "updatedAt"     : time.time(),
        }

    thread = threading.Thread(
        target=Na__RevitConvert__RunConversion, args=(job_id,),
        name=f"na-rvt2ifc-{job_id[:8]}", daemon=True,
    )
    thread.start()

    return job_id


# -----------------------------------------------------------------------------
# FUNCTION | Public Status View of a Job
# -----------------------------------------------------------------------------
def Na__RevitConvert__StatusOf(job_id):
    job = Na__RevitConvert__GetJob(job_id)
    if not job:
        return None

    # Internal paths are deliberately not exposed to the browser.
    return {
        "jobId"       : job["jobId"],
        "state"       : job["state"],
        "percent"     : round(job["percent"], 2),
        "message"     : job["message"],
        "sourceName"  : job["sourceName"],
        "outputName"  : job["outputName"],
        "outputBytes" : job["outputBytes"],
        "elapsedMs"   : int((job["updatedAt"] - job["createdAt"]) * 1000),
    }


# -----------------------------------------------------------------------------
# FUNCTION | Read the Converted IFC Bytes for a Completed Job
# -----------------------------------------------------------------------------
def Na__RevitConvert__ResultOf(job_id):
    job = Na__RevitConvert__GetJob(job_id)

    if not job:                          raise KeyError("Unknown job id.")
    if job["state"] != "completed":      raise RuntimeError(f"Job is {job['state']}, not completed.")
    if not job["outputPath"]:            raise RuntimeError("Job completed without an output path.")

    with open(job["outputPath"], "rb") as handle:
        return handle.read(), job["outputName"]


# -----------------------------------------------------------------------------
# FUNCTION | Describe What This Server Can Do
# -----------------------------------------------------------------------------
def Na__RevitConvert__Capabilities():
    converter_path = Na__RevitConvert__FindConverter()

    return {
        "revitConversion"     : converter_path is not None,
        "converterFound"      : converter_path is not None,
        "converterPath"       : converter_path,
        "converterName"       : "DataDrivenConstruction RVT2IFC Converter 18.1.0",
        "convertibleExtensions": sorted(CONVERTIBLE_EXTENSIONS),
        "outputSchema"        : "IFC4 Reference View, millimetres",
    }

# endregion -------------------------------------------------------------------
