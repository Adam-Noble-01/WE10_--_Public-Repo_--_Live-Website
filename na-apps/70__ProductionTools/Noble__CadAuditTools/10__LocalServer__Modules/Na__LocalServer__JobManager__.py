#!/usr/bin/env python3
# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS JOB MANAGER
# =============================================================================
#
# FILE      : Na__LocalServer__JobManager__.py
# MODULE    : LocalServer.JobManager
# AUTHOR    : Adam Noble - Noble Architecture
# PURPOSE   : Thread-safe registry for long-running upload/conversion jobs
# CREATED   : 07-Jul-2026
#
# DESCRIPTION:
# - Tracks background upload/conversion jobs so large DWG/DXF files can be
#   processed off the request thread while the browser polls for progress.
# - Each job carries a live stage/message/percent so the frontend overlay can
#   report exactly what the server is doing (converting, parsing, etc.).
# - Each job owns a threading.Event used to signal cancellation; the conversion
#   pipeline polls this event and aborts (terminating any subprocess) when set.
# - Finished jobs retain their result until the frontend collects it, then are
#   pruned. Stale jobs are swept opportunistically on every registry access.
#
# -----------------------------------------------------------------------------
#
# DEVELOPMENT LOG:
# 07-Jul-2026 - Version 0.3.1
# - Initial release — background job model for upload/convert with cancel.
#
# =============================================================================

import time
import uuid
import threading


# #region ---------------------------------------------------------------------
# REGION | Module State
# -----------------------------------------------------------------------------

_JOBS            = {}                                                    # <-- jobId -> job dict (in-memory registry)
_JOBS_LOCK       = threading.Lock()                                     # <-- Guards all registry mutations
_JOB_RETENTION_S = 900                                                  # <-- Seconds to keep finished jobs before sweep

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Job Lifecycle
# -----------------------------------------------------------------------------

def na_create_job(filename):
    """
    Register a new job and return its id.

    Args:
        filename (str): Source filename being processed (for UI display).

    Returns:
        str: The new job's unique id.
    """
    job_id = uuid.uuid4().hex                                           # <-- Opaque, collision-free job id
    now    = time.time()

    with _JOBS_LOCK:
        _na_sweep_stale_jobs_locked()                                   # <-- Opportunistic cleanup
        _JOBS[job_id] = {
            'id'          : job_id,
            'filename'    : filename,
            'status'      : 'running',                                  # <-- running | done | error | cancelled
            'stage'       : 'queued',
            'message'     : 'Preparing…',
            'percent'     : None,                                       # <-- None = indeterminate progress bar
            'result'      : None,
            'error'       : '',
            'createdAt'   : now,
            'updatedAt'   : now,
            '_cancelEvent': threading.Event(),                          # <-- Cancellation signal (not serialised)
        }
    return job_id


def na_update_job(job_id, stage=None, message=None, percent=None):
    """Update the live progress fields of a running job (no-op if unknown)."""
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job or job['status'] != 'running':
            return
        if stage   is not None: job['stage']   = stage
        if message is not None: job['message'] = message
        job['percent']   = percent                                     # <-- Explicitly settable to None (indeterminate)
        job['updatedAt'] = time.time()


def na_finish_job(job_id, result):
    """Mark a job complete and attach its result payload."""
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        if job['_cancelEvent'].is_set():                               # <-- Cancelled just before finishing — honour it
            job['status'] = 'cancelled'
            return
        job['status']    = 'done'
        job['stage']     = 'done'
        job['message']   = 'Complete'
        job['percent']   = 100
        job['result']    = result
        job['updatedAt'] = time.time()


def na_fail_job(job_id, error_message):
    """Mark a job as failed with a human-readable error message."""
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job['status']    = 'error'
        job['error']     = error_message
        job['message']   = error_message
        job['updatedAt'] = time.time()


def na_cancel_job(job_id):
    """
    Request cancellation of a job. Sets the cancel event so the pipeline can
    abort and terminate any running subprocess.

    Returns:
        bool: True if the job existed and was signalled, False otherwise.
    """
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return False
        job['_cancelEvent'].set()                                      # <-- Signal the worker to stop
        if job['status'] == 'running':
            job['status']  = 'cancelled'
            job['stage']   = 'cancelled'
            job['message'] = 'Cancelled'
        job['updatedAt'] = time.time()
        return True


# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Job Access
# -----------------------------------------------------------------------------

def na_get_cancel_event(job_id):
    """Return the threading.Event used to signal cancellation for a job."""
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        return job['_cancelEvent'] if job else None


def na_is_cancelled(job_id):
    """True if the job has been signalled to cancel."""
    event = na_get_cancel_event(job_id)
    return bool(event and event.is_set())


def na_get_job_public(job_id):
    """
    Return a JSON-serialisable snapshot of a job (excludes the cancel event),
    or None if the job is unknown.
    """
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        return _na_public_view_locked(job)


def na_collect_and_drop_result(job_id):
    """
    Return a finished job's public snapshot and remove it from the registry.
    Used once the frontend has successfully collected a completed result.
    """
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return None
        snapshot = _na_public_view_locked(job)
        if job['status'] in ('done', 'error', 'cancelled'):
            _JOBS.pop(job_id, None)                                     # <-- Free memory once terminal state is read
        return snapshot

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

def _na_public_view_locked(job):
    """Build a serialisable view of a job. Caller must hold _JOBS_LOCK."""
    return {
        'id'       : job['id'],
        'filename' : job['filename'],
        'status'   : job['status'],
        'stage'    : job['stage'],
        'message'  : job['message'],
        'percent'  : job['percent'],
        'result'   : job['result'],
        'error'    : job['error'],
    }


def _na_sweep_stale_jobs_locked():
    """Remove finished jobs older than the retention window. Caller holds lock."""
    cutoff = time.time() - _JOB_RETENTION_S
    stale  = [
        jid for jid, job in _JOBS.items()
        if job['status'] != 'running' and job['updatedAt'] < cutoff
    ]
    for jid in stale:
        _JOBS.pop(jid, None)

# endregion -------------------------------------------------------------------
