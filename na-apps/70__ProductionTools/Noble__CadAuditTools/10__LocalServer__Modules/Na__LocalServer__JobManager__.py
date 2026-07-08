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
# 08-Jul-2026 - Version 0.4.0
# - Added a mid-job DECISION pause: na_request_decision / na_provide_decision /
#   na_wait_for_decision let the upload worker stop at 'awaiting-decision', hand a
#   question (e.g. "purge embedded images?") to the frontend via the job 'meta',
#   and block until the user answers — without re-uploading the file.
#
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

_JOBS             = {}                                                   # <-- jobId -> job dict (in-memory registry)
_JOBS_LOCK        = threading.Lock()                                    # <-- Guards all registry mutations
_JOB_RETENTION_S  = 900                                                 # <-- Seconds to keep finished jobs before sweep
_DECISION_TIMEOUT = 600                                                 # <-- Max seconds a worker waits for a user decision

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
            'id'            : job_id,
            'filename'      : filename,
            'status'        : 'running',                                # <-- running | awaiting-decision | done | error | cancelled
            'stage'         : 'queued',
            'message'       : 'Preparing…',
            'percent'       : None,                                     # <-- None = indeterminate progress bar
            'result'        : None,
            'error'         : '',
            'meta'          : {},                                       # <-- Extra public data (e.g. imageCount for a decision)
            'createdAt'     : now,
            'updatedAt'     : now,
            '_cancelEvent'  : threading.Event(),                        # <-- Cancellation signal (not serialised)
            '_decisionEvent': threading.Event(),                        # <-- Set when the user answers a mid-job question
            '_decision'     : None,                                     # <-- The user's answer string (e.g. 'keep'|'purge')
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
        job['_decisionEvent'].set()                                    # <-- Unblock a worker paused on a decision
        if job['status'] in ('running', 'awaiting-decision'):
            job['status']  = 'cancelled'
            job['stage']   = 'cancelled'
            job['message'] = 'Cancelled'
        job['updatedAt'] = time.time()
        return True


# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Mid-Job Decision Pause
# -----------------------------------------------------------------------------

def na_request_decision(job_id, stage, meta):
    """
    Pause a running job to ask the frontend a question. The job flips to
    'awaiting-decision' and publishes `meta` (e.g. { imageCount }) so the poller
    can render the right dialog. Resets any prior decision on this job.
    """
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job:
            return
        job['_decision'] = None
        job['_decisionEvent'].clear()
        job['status']    = 'awaiting-decision'
        job['stage']     = stage
        job['message']   = 'Waiting for your choice…'
        job['percent']   = None
        job['meta']      = meta or {}
        job['updatedAt'] = time.time()


def na_provide_decision(job_id, decision):
    """
    Supply the user's answer to a pending decision and resume the job. Returns
    True only if the job existed and was actually awaiting a decision.
    """
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        if not job or job['status'] != 'awaiting-decision':
            return False
        job['_decision'] = decision
        job['status']    = 'running'
        job['stage']     = 'resuming'
        job['message']   = 'Resuming…'
        job['meta']      = {}                                          # <-- Clear the question payload
        job['updatedAt'] = time.time()
        job['_decisionEvent'].set()                                    # <-- Wake the blocked worker
        return True


def na_wait_for_decision(job_id, cancel_event=None, timeout=_DECISION_TIMEOUT):
    """
    Block the worker thread until the user answers, the job is cancelled, or the
    decision times out. Returns the decision string, or None on cancel/timeout/
    disappearance (the worker treats None as "abort this load").
    """
    event = na_get_decision_event(job_id)
    if event is None:
        return None

    deadline = time.monotonic() + max(1, timeout)
    while True:
        if cancel_event is not None and cancel_event.is_set():
            return None
        if na_get_job_public(job_id) is None:                         # <-- Job swept/expired while waiting
            return None
        if event.wait(0.25):                                          # <-- Woken by provide/cancel
            with _JOBS_LOCK:
                job = _JOBS.get(job_id)
                if not job or job['_cancelEvent'].is_set():
                    return None
                return job['_decision']
        if time.monotonic() >= deadline:
            print(f"[Na__JobManager] Decision timed out for job {job_id}")
            return None


def na_get_decision_event(job_id):
    """Return the threading.Event that fires when a job's decision is provided."""
    with _JOBS_LOCK:
        job = _JOBS.get(job_id)
        return job['_decisionEvent'] if job else None

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
        'meta'     : job.get('meta', {}),                              # <-- Decision payload (e.g. imageCount)
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
