const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to index
    if (localStorage.getItem('ligeirinho_admin_token')) {
        window.location.href = 'index.html';
    }

    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-message');
    const submitBtn = document.getElementById('submit-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) return;

        // Reset state
        errorMsg.style.display = 'none';
        submitBtn.disabled = true;
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader" class="loader"></i> <span>Verificando...</span>';
        lucide.createIcons();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.token) {
                // Success!
                localStorage.setItem('ligeirinho_admin_token', data.token);
                localStorage.setItem('ligeirinho_admin_user', JSON.stringify(data.user));
                
                // Show success state on button
                submitBtn.style.background = '#22c55e';
                submitBtn.innerHTML = '<i data-lucide="check"></i> <span>Sucesso! Entrando...</span>';
                lucide.createIcons();

                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 800);
            } else {
                // Error
                throw new Error(data.error || 'Credenciais inválidas');
            }
        } catch (err) {
            console.error('[Login Error]', err);
            errorMsg.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4"></i> <span>' + (err.message || 'Erro ao conectar ao servidor') + '</span>';
            errorMsg.style.display = 'flex';
            errorMsg.style.alignItems = 'center';
            errorMsg.style.gap = '0.5rem';
            lucide.createIcons();
            
            // Shake effect
            loginForm.parentElement.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-5px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(-5px)' },
                { transform: 'translateX(5px)' },
                { transform: 'translateX(0)' }
            ], { duration: 400 });

            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnContent;
            lucide.createIcons();
        }
    });
});
