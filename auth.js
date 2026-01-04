/**
 * Learn C Programming - Authentication Module
 * -------------------------------------------
 * This file handles logging in with Google.
 * We use a service called "Supabase" to handle the complex security parts.
 * 
 * STRUCTURE:
 * 1. Configuration (API Keys)
 * 2. State (Who is logged in?)
 * 3. Initialization (Start up Supabase)
 * 4. User Management (Update UI based on login)
 * 5. Actions (Login, Logout)
 */

(function () {
    // ============================================
    // 1. CONFIGURATION
    // ============================================
    // These keys connect our app to the Supabase backend.
    // In a real pro app, these would be hidden in environment variables,
    // but for this static site, they are safe to be public (anon key).
    const SUPABASE_URL = 'https://mqegebadvrazlizwwzjm.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_CTaxwE8zwyQCe1ao_CiGzQ_2sA-nIaA';

    // ============================================
    // 2. STATE
    // ============================================
    let supabase = null;      // The Supabase client library instance
    let currentUser = null;   // The currently logged in user object

    // ============================================
    // 3. INITIALIZATION
    // ============================================
    // This function starts everything up.
    function init() {
        // Check if the Supabase script loaded from the HTML
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase library not loaded. Check script tags in index.html');
            return;
        }

        // Initialize the client
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Supabase Initialized');

            // Listen for changes in authentication status (Login, Logout, etc.)
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth Event:', event);

                if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                    // User just logged in or we found an existing session
                    updateUser(session?.user);

                    // Clean up the URL (remove ugly tokens after Google redirect)
                    if (window.location.hash && window.location.hash.includes('access_token')) {
                        window.history.replaceState(null, null, window.location.pathname);
                        App.Utils.showToast('Successfully logged in!', 'success');
                    }
                }
                else if (event === 'SIGNED_OUT') {
                    // User logged out
                    updateUser(null);
                }
            });

            // Double check existing session just in case
            checkSession();

        } catch (e) {
            console.error('Error initializing Supabase:', e);
        }
    }

    // Helper to check if we are already logged in
    async function checkSession() {
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        updateUser(session?.user);
    }

    // ============================================
    // 4. USER MANAGEMENT (UI UPDATES)
    // ============================================
    // This function controls what shows on the screen based on login status.
    function updateUser(user) {
        currentUser = user || null;

        // Get references to HTML elements
        const viewLogin = document.getElementById('view-login');
        const viewDashboard = document.getElementById('view-dashboard');
        const sidebarName = document.getElementById('user-name');
        const profileBtn = document.getElementById('profile-btn');

        if (currentUser) {
            // --- CASE: USER IS LOGGED IN ---
            console.log('User is logged in:', currentUser.email);

            // 1. Hide Login Screen
            if (viewLogin) {
                viewLogin.hidden = true;
                viewLogin.classList.remove('view--active');
                viewLogin.style.display = 'none'; // CSS Force hide
            }

            // 2. Show Dashboard
            if (viewDashboard) {
                viewDashboard.hidden = false;
                viewDashboard.classList.add('view--active');
                viewDashboard.style.display = ''; // Restore default display
            }

            // Remove "login mode" styling from body
            document.body.classList.remove('state-login');

            // Show Profile Button
            if (profileBtn) profileBtn.style.display = 'inline-flex';

            // Update Name in Sidebar
            const name = currentUser.user_metadata?.full_name || currentUser.email.split('@')[0];
            if (sidebarName) sidebarName.textContent = name;

            // Sync with main App state
            if (window.App && App.state) {
                App.state.user = currentUser;
            }

        } else {
            // --- CASE: USER IS LOGGED OUT ---
            console.log('User is logged out');

            // 1. Show Login Screen
            if (viewLogin) {
                viewLogin.hidden = false;
                viewLogin.classList.add('view--active');
                viewLogin.style.display = '';
            }

            // 2. Hide Dashboard
            if (viewDashboard) {
                viewDashboard.hidden = true;
                viewDashboard.classList.remove('view--active');
                viewDashboard.style.display = 'none';
            }

            // Add "login mode" styling (hides sidebar etc.)
            document.body.classList.add('state-login');

            // Hide Profile Button
            if (profileBtn) profileBtn.style.display = 'none';

            // Reset Name
            if (sidebarName) sidebarName.textContent = 'Student';
        }
    }

    // ============================================
    // 5. ACTIONS
    // ============================================

    // Action: Clicked "Sign in with Google"
    async function signInWithGoogle() {
        if (!supabase) {
            alert('Supabase not configured. Please check console.');
            return;
        }

        // Redirect user to Google
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Where to come back to after login? (Current page)
                redirectTo: window.location.origin
            }
        });

        if (error) {
            console.error('Login error:', error);
            App.Utils.showToast('Login failed: ' + error.message, 'error');
        }
    }

    // Action: Clicked "Sign Out"
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

    // ============================================
    // EXPORT TO APP
    // ============================================
    // Determine where to attach these functions so App can use them.
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
