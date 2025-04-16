// Error handler for module loading issues
window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('module')) {
        console.error('Module loading error:', event.error);
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Error loading modules. Check console for details.';
            statusEl.style.display = 'block';
            statusEl.className = 'error';
        }
    }
});

// Additional initialization once DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the status panel
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.className = 'APPL__Status-Panel';
        statusEl.style.display = 'block';
    }
}); 