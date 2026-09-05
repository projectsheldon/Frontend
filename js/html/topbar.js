(function()
{
    function navMarkup()
    {
        return '<nav class="fixed top-0 w-full z-[100] p-4 md:p-5 flex justify-center">' +
            '<div class="w-full max-w-[1265px] glass-nav h-14 md:h-16 px-6 md:px-8 rounded-full flex items-center justify-between relative">' +
                '<div class="flex items-center gap-3 z-10 shrink-0">' +
                    '<div class="logo-box w-8 h-8 rounded-lg flex items-center justify-center">' +
                        '<img src="/favicon/favicon.ico" alt="Logo" class="w-8 h-8 rounded-lg">' +
                    '</div>' +
                    '<span class="text-xl font-black tracking-tighter text-white hidden sm:block">SHELDON</span>' +
                '</div>' +

                '<div class="absolute left-1/2 -translate-x-1/2 flex items-center h-full nav-tabs-desktop">' +
                    '<a href="/" class="nav-tab">Home</a>' +
                    '<a href="/luavm/" class="nav-tab">Lua VM</a>' +
                    '<a href="/resellers/directory/" class="nav-tab">Resellers</a>' +
                '</div>' +

                '<button class="mobile-menu-btn" onclick="toggleMobileMenu()">' +
                    '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />' +
                    '</svg>' +
                '</button>' +

                '<div class="mobile-menu" id="mobileMenu">' +
                    '<a href="/" class="nav-tab">Home</a>' +
                    '<a href="/luavm/" class="nav-tab">Lua VM</a>' +
                    '<a href="/resellers/directory/" class="nav-tab">Resellers</a>' +
                '</div>' +

                '<div class="flex items-center gap-5 z-10 shrink-0">' +
                    '<div id="user-profile-trigger" class="hidden flex items-center gap-2 cursor-pointer group" style="position: relative;">' +
                        '<div class="flex flex-col leading-none text-right gap-0.5">' +
                            '<div class="user-name text-[0.7rem] font-bold text-neutral-400 transition-colors">Username</div>' +
                            '<div class="user-balance text-[0.6rem] font-bold text-[#c7b18f] tracking-wider hidden leading-none" style="margin-top: 1px"></div>' +
                        '</div>' +
                        '<div class="flex items-center gap-2 cursor-pointer group" style="position:relative;">' +
                            '<button class="flex items-center gap-2 bg-white/7 border border-white/15 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-widest uppercase text-white/80 cursor-pointer transition-all duration-200 hover:bg-white/12 hover:border-white/30" style="padding:5px 14px 5px 5px;">' +
                                '<div class="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden group-hover:bg-white/10 transition-all group-hover:scale-105 ">' +
                                    '<img class="user-avatar w-full h-full object-cover hidden" src="" alt="Avatar">' +
                                    '<svg class="default-avatar w-full h-full text-neutral-400" fill="#ffffff" viewBox="0 0 24 24">' +
                                        '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />' +
                                    '</svg>' +
                                '</div>' +
                                '<span class="text-white/80 transition-colors duration-200 group-hover:text-[#c7b18f]">Account</span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +

                    '<button id="discord-login-btn" class="btn-discord px-5 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-wider transition-all" aria-label="Login with Discord">' +
                        '<svg class="discord-login-icon w-3.5 h-3.5" viewBox="0 0 127.14 96.36" fill="#ffffff" aria-hidden="true">' +
                            '<path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a.41.41,0,0,0-.43.2,72.48,72.48,0,0,0-3.17,6.52,97.26,97.26,0,0,0-29,0,72.84,72.84,0,0,0-3.19-6.52.4.4,0,0,0-.43-.2A105.09,105.09,0,0,0,19.44,8.07a.44.44,0,0,0-.2.07C2.12,34,1.15,59.39,3.46,84.41a.48.48,0,0,0,.19.34A105.77,105.77,0,0,0,35.77,96.36a.42.42,0,0,0,.46-.22,74.22,74.22,0,0,0,6.42-10.38.4.4,0,0,0-.22-.56,68.7,68.7,0,0,1-10-4.76.41.41,0,0,1,0-.69c.83-.62,1.67-1.28,2.46-1.95a.39.39,0,0,1,.41-.05,73.4,73.4,0,0,0,57.48,0,.39.39,0,0,1,.41.05c.79.67,1.63,1.33,2.46,1.95a.41.41,0,0,1,0,.69,68.61,68.61,0,0,1-10,4.76.41.41,0,0,0-.22.56,74.8,74.8,0,0,0,6.43,10.38.42.42,0,0,0,.46.22,105.48,105.48,0,0,0,32.11-11.61.45.45,0,0,0,.19-.34c2.72-28.53-4.67-53.59-20-76.27A.39.39,0,0,0,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.07,65.69,84.69,65.69Z" />' +
                        '</svg>' +
                        '<svg class="discord-logout-icon w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                            '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />' +
                            '<polyline points="16 17 21 12 16 7" />' +
                            '<line x1="21" y1="12" x2="9" y2="12" />' +
                        '</svg>' +
                        '<svg class="discord-login-spinner w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
                            '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />' +
                            '<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />' +
                        '</svg>' +
                        '<span id="discord-login-txt" class="hidden sm:inline">Login</span>' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</nav>';
    }

    function injectTopbar()
    {
        const placeholder = document.getElementById('shared-topbar');
        if(!placeholder || placeholder.dataset.topbarInjected) return;
        placeholder.dataset.topbarInjected = '1';
        placeholder.outerHTML = navMarkup();
        markActiveTab();
    }

    // Highlight tab matching current path.
    function markActiveTab()
    {
        const path = (window.location.pathname.replace(/\/+$/, '') || '/');
        const tabForPath = path === '/luavm' || path.startsWith('/luavm/')
            ? '/luavm/'
            : (path.startsWith('/resellers') ? '/resellers/directory/' : '/');
        document.querySelectorAll('.nav-tab').forEach(tab =>
        {
            tab.classList.toggle('active', tab.getAttribute('href') === tabForPath);
        });
    }

    // Inject now so deferred scripts can capture login nodes.
    if(document.getElementById('shared-topbar'))
    {
        injectTopbar();
    }
    else if(document.readyState === 'loading')
    {
        document.addEventListener('DOMContentLoaded', injectTopbar);
    }

    window.toggleMobileMenu = function()
    {
        const menu = document.getElementById('mobileMenu');
        if(menu) menu.classList.toggle('show');
    };

    // Close mobile menu on link click.
    document.addEventListener('click', function(e)
    {
        const link = e.target && e.target.closest ? e.target.closest('#mobileMenu .nav-tab') : null;
        if(link)
        {
            const menu = document.getElementById('mobileMenu');
            if(menu) menu.classList.remove('show');
            return;
        }

        const menu = document.getElementById('mobileMenu');
        if(!menu || !menu.classList.contains('show')) return;
        if(menu.contains(e.target) || e.target.closest('.mobile-menu-btn')) return;
        menu.classList.remove('show');
    });

    window.addEventListener('resize', function()
    {
        const menu = document.getElementById('mobileMenu');
        if(menu && window.innerWidth > 768) menu.classList.remove('show');
    });

    // Navbar darkens once scrolled.
    window.addEventListener('scroll', function()
    {
        const navbar = document.querySelector('.glass-nav');
        if(!navbar) return;
        if(window.scrollY > 50) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    });
})();
