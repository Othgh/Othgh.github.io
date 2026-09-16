/*!
 * 站点特效（由 scripts/custom.js 注入到 body_end）
 *   1. 鼠标粒子拖尾   2. 头像卡打字机标题   3. 滚动淡入 / 卡片悬浮 / 导航毛玻璃
 *
 * 兼容 Icarus 的 PJAX 无刷新跳转：监听 pjax:complete / pjax:end 重新初始化。
 * 所有初始化函数都是幂等的（靠元素上的 data 标记），脚本重复执行也安全。
 * 触碰设备（手机/平板）自动不启用粒子；系统开了"减少动态效果"则全部关闭。
 */
(function () {
    'use strict';

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

    /* ==================== 1. 鼠标粒子拖尾 ==================== */

    var canvas = null;
    var ctx = null;
    var dpr = 1;
    var particles = [];
    var rafId = 0;
    var lastX = null;
    var lastY = null;
    var COLORS = ['#00e0b0', '#00b89c', '#7ef0d4', '#39d9b6'];

    function sizeCanvas() {
        if (!canvas) return;
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
    }

    function tick() {
        rafId = 0;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (var i = particles.length - 1; i >= 0; i--) {
            var p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.985;
            p.vy *= 0.985;
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.4, p.r * p.life), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // 粒子放完就停掉 rAF，不空转烧 CPU
        if (particles.length) {
            rafId = requestAnimationFrame(tick);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    function onMove(e) {
        var x = e.clientX * dpr;
        var y = e.clientY * dpr;
        var dist = lastX === null ? 0 : Math.sqrt((x - lastX) * (x - lastX) + (y - lastY) * (y - lastY));
        lastX = x;
        lastY = y;

        var count = Math.min(5, 1 + Math.floor(dist / (10 * dpr)));
        for (var i = 0; i < count; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 5 * dpr,
                y: y + (Math.random() - 0.5) * 5 * dpr,
                vx: (Math.random() - 0.5) * 0.5 * dpr,
                vy: (Math.random() - 0.5) * 0.5 * dpr - 0.12 * dpr,
                r: (Math.random() * 2.2 + 1.1) * dpr,
                life: 1,
                decay: 0.016 + Math.random() * 0.022,
                color: COLORS[(Math.random() * COLORS.length) | 0]
            });
        }
        if (particles.length > 300) {
            particles.splice(0, particles.length - 300);
        }
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function initCursor() {
        if (reduce || !finePointer) return;
        if (document.getElementById('si-cursor-canvas')) return;   // 幂等
        canvas = document.createElement('canvas');
        canvas.id = 'si-cursor-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        sizeCanvas();
        window.addEventListener('resize', sizeCanvas);
        window.addEventListener('mousemove', onMove, { passive: true });
    }

    /* ==================== 2. 头像卡打字机 ==================== */

    function typeInto(el, text, caret, speed, done) {
        el.textContent = '';
        el.appendChild(caret);
        var i = 0;
        (function step() {
            if (i < text.length) {
                caret.insertAdjacentText('beforebegin', text.charAt(i++));
                setTimeout(step, speed + Math.random() * 70);
            } else if (done) {
                setTimeout(done, 200);
            }
        })();
    }

    function initTypewriter() {
        if (reduce) return;
        // 用头像图定位到 profile 挂件卡，避免误伤文章标题（同为 p.title）
        var avatar = document.querySelector('.card.widget img.is-rounded');
        if (!avatar) return;
        var card = avatar.closest('.card');
        if (!card) return;

        var nameEl = card.querySelector('p.title');
        if (!nameEl || nameEl.getAttribute('data-si-typed')) return;
        nameEl.setAttribute('data-si-typed', '1');

        var subEl = nameEl.nextElementSibling;
        var hasSub = subEl && subEl.tagName === 'P';
        var name = (nameEl.textContent || '').trim();
        var sub = hasSub ? (subEl.textContent || '').trim() : '';

        var caret = document.createElement('span');
        caret.className = 'si-caret';

        typeInto(nameEl, name, caret, 130, function () {
            if (!hasSub || !sub) return;
            typeInto(subEl, sub, caret, 55, null);   // 副标题打得更快，光标留着继续闪
        });
    }

    /* ==================== 3. 滚动淡入 / 卡片悬浮 / 导航 ==================== */

    var io = null;

    function reveal(el) {
        el.classList.add('si-in');
        setTimeout(function () {
            // 动画结束后摘掉这两个类，把 transform 让回给 :hover 的快速过渡
            el.classList.remove('si-fade');
            el.classList.remove('si-in');
        }, 750);
    }

    function initFade() {
        if (reduce || !('IntersectionObserver' in window)) return;
        if (!io) {
            io = new IntersectionObserver(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].isIntersecting) {
                        io.unobserve(entries[i].target);
                        reveal(entries[i].target);
                    }
                }
            }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
        }

        var els = document.querySelectorAll('.card:not(.widget)');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            if (el.getAttribute('data-si-fade')) continue;
            el.setAttribute('data-si-fade', '1');
            // 首屏里的内容不做动画，否则一进页面会闪一下
            if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue;
            el.classList.add('si-fade');
            io.observe(el);
        }
    }

    function initNavbar() {
        var nav = document.querySelector('.navbar.navbar-main');
        if (!nav || nav.getAttribute('data-si-nav')) return;
        nav.setAttribute('data-si-nav', '1');
        var onScroll = function () {
            if (window.scrollY > 10) {
                nav.classList.add('si-scrolled');
            } else {
                nav.classList.remove('si-scrolled');
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ==================== 启动 ==================== */

    function init() {
        initTypewriter();
        initFade();
        initNavbar();
    }

    initCursor();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    document.addEventListener('pjax:complete', init);
    document.addEventListener('pjax:end', init);
})();
