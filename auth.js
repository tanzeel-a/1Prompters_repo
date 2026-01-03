/**
 * Learn C Programming - Authentication
 * Handles Google OAuth using Supabase
 */

(function () {
    // CONFIGURATION
    // NOTE: Since this is a static site without a build step (like Vite),
    // we cannot access .env files directly.
    // Please paste your Supabase keys here from your .env file.
    const SUPABASE_URL = 'https://mqegebadvrazlizwwzjm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_CTaxwE8zwyQCe1ao_CiGzQ_2sA-nIaA';

    // State
    let supabase = null;
    let currentUser = null;

    // Initialize Auth
    function init() {
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase library not loaded. Check script tags in index.html');
            return;
        }

        if (SUPABASE_URL.includes('PASTE_YOUR')) {
            console.warn('Supabase keys missing in auth.js. Login will not work.');
            return;
        }

        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase Initialized');

            // Check for returning session (handled by Supabase automatically in localStorage)
            checkSession();

            // Check for OAuth callback in URL (hash fragment)
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                console.log('Detected OAuth callback');
                // Supabase client handles this automatically on init usually,
                // but let's ensure we update UI once session is established.
                supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN') {
                        // Clear hash to clean URL
                        window.history.replaceState(null, null, ' ');
                        updateUser(session?.user);
                        App.Utils.showToast('Successfully logged in!', 'success');
                    }
                });
            }

        } catch (e) {
            console.error('Error initializing Supabase:', e);
        }
    }

    // Check current session
    async function checkSession() {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        updateUser(session?.user);

        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event);
            updateUser(session?.user);
        });
    }

    // Update User State
    function updateUser(user) {
        currentUser = user || null;

        // Update UI
        const loginBtn = document.getElementById('login-btn');
        const profileBtn = document.getElementById('profile-btn');
        const sidebarName = document.getElementById('user-name');

        if (currentUser) {
            // Logged In
            if (loginBtn) loginBtn.style.display = 'none';
            if (profileBtn) profileBtn.style.display = 'inline-flex';

            // Update Name
            const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
            if (sidebarName) sidebarName.textContent = name;

            // Update App State if exists
            if (window.App && App.state) {
                App.state.user = currentUser;
            }
        } else {
            // Logged Out
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (profileBtn) profileBtn.style.display = 'none'; // Optional: keep profile for local settings? 
            // User requested login button, so maybe hide profile or keep it for settings? 
            // Implementing strict toggle for now to show difference.

            if (sidebarName) sidebarName.textContent = 'Student';
        }
    }

    // Sign In with Google
    async function signInWithGoogle() {
        if (!supabase) {
            alert('Supabase not configured. Please check console.');
            return;
        }
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href // Return to current page
            }
        });

        if (error) {
            console.error('Login error:', error);
            App.Utils.showToast('Login failed: ' + error.message, 'error');
        }
    }

    // Sign Out
    async function signOut() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Logout error:', error);
        } else {
            App.Utils.showToast('Logged out successfully', 'info');
            updateUser(null);
        }
    }

    // Expose to App
    // We check if App exists, if not we wait or define it minimally to extend later?
    // Since this runs after App, App should exist.
    if (typeof window.App !== 'undefined') {
        window.App.Auth = {
            init,
            signInWithGoogle,
            signOut,
            getUser: () => currentUser
        };
    } else {
        console.error('App object not found. auth.js must run after app.js');
    }

})();
