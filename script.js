feather.replace();

// Smooth fade navigation transitions
document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => {
            window.location.href = e.target.href;
        }, 300);
    });
});

// Mobile menu toggle
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}
