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

            // Set up listener FIRST to catch any initial events
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth Event:', event, session?.user?.email);

                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    updateUser(session?.user);
                    // Clear hash if it exists (clean URL after OAuth)
                    if (window.location.hash && window.location.hash.includes('access_token')) {
                        window.history.replaceState(null, null, window.location.pathname);
                        App.Utils.showToast('Successfully logged in!', 'success');
                    }
                } else if (event === 'SIGNED_OUT') {
                    updateUser(null);
                }
            });

            // Then check existing session (for page reloads)
            checkSession();

        } catch (e) {
            console.error('Error initializing Supabase:', e);
        }
    }

    // Check current session
    async function checkSession() {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        updateUser(session?.user);
    }

    // Update User State
    function updateUser(user) {
        currentUser = user || null;

        // View Elements
        const viewLogin = document.getElementById('view-login');
        const viewDashboard = document.getElementById('view-dashboard');
        const sidebarName = document.getElementById('user-name');
        const profileBtn = document.getElementById('profile-btn');

        if (currentUser) {
            // LOGGED IN: Show Dashboard
            if (viewLogin) viewLogin.hidden = true;
            if (viewDashboard) viewDashboard.hidden = false;
            document.body.classList.remove('state-login');

            if (profileBtn) profileBtn.style.display = 'inline-flex';

            // Update Name
            const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
            if (sidebarName) sidebarName.textContent = name;

            // Update App State if exists
            if (window.App && App.state) {
                App.state.user = currentUser;
            }
        } else {
            // LOGGED OUT: Show Login (Gatekeeper)
            if (viewLogin) viewLogin.hidden = false;
            if (viewDashboard) viewDashboard.hidden = true;
            document.body.classList.add('state-login');

            if (profileBtn) profileBtn.style.display = 'none';

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
                redirectTo: window.location.origin // Ensure we go to the root/home
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
