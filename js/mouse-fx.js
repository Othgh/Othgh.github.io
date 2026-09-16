/*!
 * 鼠标跟随光斑 —— 一个柔和的光晕跟着鼠标走，带一点延迟（缓动）
 *
 * 实现要点：
 *   - 用 transform: translate3d 移动（走合成层，不触发重排）
 *   - 只在鼠标停下后自动停掉 rAF，不空转烧 CPU
 *   - mix-blend-mode: screen 让它在深色背景上"提亮"而不是"盖住"，
 *     透明度压得很低，所以文字依然清楚
 *   - 触屏设备（pointer: coarse）不启用
 *
 * CSS 在 scripts/custom.js 里一起注入。
 */
(function () {
    'use strict';

    var finePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    if (!finePointer) return;
    if (document.getElementById('si-mouse-glow')) return;   // 幂等

    var el = document.createElement('div');
    el.id = 'si-mouse-glow';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 3;
    var x = targetX;
    var y = targetY;
    var raf = 0;

    function tick() {
        raf = 0;
        x += (targetX - x) * 0.14;
        y += (targetY - y) * 0.14;
        el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
        // 还差得远就继续跑，追上了就停（省电）
        if (Math.abs(targetX - x) > 0.5 || Math.abs(targetY - y) > 0.5) {
            raf = requestAnimationFrame(tick);
        }
    }

    window.addEventListener('mousemove', function (e) {
        targetX = e.clientX;
        targetY = e.clientY;
        if (el.style.opacity !== '1') el.style.opacity = '1';
        if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    // 鼠标移出窗口就淡掉
    document.addEventListener('mouseleave', function () {
        el.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () {
        el.style.opacity = '1';
    });
})();
