/*!
 * 粒子连线（鼠标吸引版）
 *
 * 为什么不用主题自带的 canvas_nest：那是个 1.5KB 的库，连线距离是按平方硬编码的
 * （粒子间 6000 ≈ 77px、鼠标周围 20000 ≈ 141px），配置里改不了。
 * 这里自己实现一份，所有参数都在下面 CONFIG 里，随时可调。
 *
 * 行为：满屏小点自由飘动；距离够近的两点之间连线（越近线越亮）；
 *       鼠标附近一定范围内的点会被吸引过去，并和鼠标连线。
 */
(function () {
    'use strict';

    var CONFIG = {
        count: 180,             // 粒子数量（越多线越密）
        linkDist: 140,          // 【粒子之间】连线距离，单位 px —— 想"范围大一点"就调大这个
        mouseDist: 230,         // 【鼠标周围】连线 + 吸引距离，px
        mousePull: 0.045,       // 鼠标吸引力（0 就是只连线不吸引）
        color: '0, 224, 176',   // 颜色 RGB，用逗号分隔
        opacity: 0.9,           // 整体透明度
        speed: 0.45,            // 飘动速度（px/帧）
        zIndex: -1,             // 层级：-1 = 垫在内容下面（不挡字）
        mobile: false           // 触屏设备是否启用
    };

    if (!CONFIG.mobile && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    if (document.getElementById('si-particle-net')) return;   // 幂等

    var canvas = document.createElement('canvas');
    canvas.id = 'si-particle-net';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:' +
        CONFIG.zIndex + ';opacity:' + CONFIG.opacity;
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // 粒子
    var dots = [];
    function spawn() {
        dots = [];
        for (var i = 0; i < CONFIG.count; i++) {
            dots.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() * 2 - 1) * CONFIG.speed,
                vy: (Math.random() * 2 - 1) * CONFIG.speed
            });
        }
    }
    spawn();

    var mouse = { x: null, y: null };
    window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }, { passive: true });
    document.addEventListener('mouseleave', function () {
        mouse.x = mouse.y = null;
    });

    var linkSq = CONFIG.linkDist * CONFIG.linkDist;
    var mouseSq = CONFIG.mouseDist * CONFIG.mouseDist;

    function frame() {
        ctx.clearRect(0, 0, W, H);

        for (var i = 0; i < dots.length; i++) {
            var d = dots[i];
            d.x += d.vx;
            d.y += d.vy;
            // 撞墙反弹
            if (d.x < 0 || d.x > W) d.vx = -d.vx;
            if (d.y < 0 || d.y > H) d.vy = -d.vy;

            // 鼠标吸引：距离越近拽得越紧
            if (mouse.x !== null) {
                var mdx = d.x - mouse.x;
                var mdy = d.y - mouse.y;
                var mdist = mdx * mdx + mdy * mdy;
                if (mdist < mouseSq && mdist > 1) {
                    d.x -= mdx * CONFIG.mousePull;
                    d.y -= mdy * CONFIG.mousePull;
                }
            }

            ctx.fillStyle = 'rgba(' + CONFIG.color + ',0.9)';
            ctx.fillRect(d.x - 0.6, d.y - 0.6, 1.4, 1.4);

            // 与其他粒子连线（只算 i 之后的，避免重复）
            for (var j = i + 1; j < dots.length; j++) {
                var o = dots[j];
                var dx = d.x - o.x;
                var dy = d.y - o.y;
                var distSq = dx * dx + dy * dy;
                if (distSq < linkSq) {
                    var a = (1 - distSq / linkSq) * 0.55;
                    ctx.strokeStyle = 'rgba(' + CONFIG.color + ',' + a + ')';
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(o.x, o.y);
                    ctx.stroke();
                }
            }

            // 与鼠标连线
            if (mouse.x !== null) {
                var mx = d.x - mouse.x;
                var my = d.y - mouse.y;
                var msq = mx * mx + my * my;
                if (msq < mouseSq) {
                    var ma = (1 - msq / mouseSq) * 0.7;
                    ctx.strokeStyle = 'rgba(' + CONFIG.color + ',' + ma + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
        }
        raf = requestAnimationFrame(frame);
    }

    var raf = requestAnimationFrame(frame);

    // 切到后台就停，不白烧 CPU
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            cancelAnimationFrame(raf);
            raf = 0;
        } else if (!raf) {
            raf = requestAnimationFrame(frame);
        }
    });
})();
