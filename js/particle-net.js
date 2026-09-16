/*!
 * 粒子连线（跟随鼠标版）
 *
 * 为什么不用主题自带的 canvas_nest：那是个 1.5KB 的库，连线距离是按平方硬编码的
 * （粒子间 6000 ≈ 77px、鼠标周围 20000 ≈ 141px），配置里改不了。
 * 这里自己实现一份，所有参数都在下面 CONFIG 里，随时可调。
 *
 * 行为：满屏小点各自飘移（速度有下限，保证都在动）；
 *       距离够近的两点之间连线，越近线越亮；
 *       鼠标附近一定范围内的点会连一条线到光标 —— 注意是【只连线、不吸引】，
 *       把 mousePull 调大粒子会全堆到光标上变成"蜘蛛网"。
 *
 * 层级默认 -1（垫在内容下面），不会盖住文章卡片；改成正数才会盖上去。
 */
(function () {
    'use strict';

    var CONFIG = {
        count: 145,             // 粒子数量（越多线越密）
        linkDist: 125,          // 【粒子之间】连线距离，单位 px
        mouseDist: 160,         // 【鼠标周围】连线距离，px（只连线，不吸引）
        mousePull: 0,           // 鼠标吸引力：0 = 只连线、不把粒子拽过来
                                // （调大了粒子会全堆在光标上，看起来像蜘蛛网）
        color: '0, 224, 176',   // 颜色 RGB，用逗号分隔
        opacity: 0.8,           // 整体透明度
        speed: 0.95,            // 飘移速度上限（px/帧）—— 鼠标不动时画面靠它保持"活着"
        minSpeedRatio: 0.45,    // 最慢粒子的速度占 speed 的比例（保证没有粒子看起来是静止的）
        zIndex: -1,             // 层级：-1 = 垫在内容下面（不覆盖文章）；正数 = 盖在卡片上
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
            // 方向随机、速度在 [speed*minSpeedRatio, speed] 之间随机 ——
            // 关键是保证每个粒子都动，不然分到接近 0 速度的那些看起来就是静止的
            var ang = Math.random() * Math.PI * 2;
            var sp = CONFIG.speed * (CONFIG.minSpeedRatio + Math.random() * (1 - CONFIG.minSpeedRatio));
            dots.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp
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

    // 性能关键：把连线按透明度分成几档，每档用一条路径批量描边。
    // 否则每条线都要 beginPath+stroke 一次，180 个粒子会有上千次绘制调用，很卡。
    var BUCKETS = 5;
    var buckets = [];
    for (var b = 0; b < BUCKETS; b++) buckets.push([]);
    var mouseSegs = [];

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

            // 与其他粒子连线（只算 i 之后的，避免重复）—— 先收集，稍后批量画
            for (var j = i + 1; j < dots.length; j++) {
                var o = dots[j];
                var dx = d.x - o.x;
                var dy = d.y - o.y;
                var distSq = dx * dx + dy * dy;
                if (distSq < linkSq) {
                    var t = 1 - distSq / linkSq;
                    buckets[Math.min(BUCKETS - 1, (t * BUCKETS) | 0)].push(d.x, d.y, o.x, o.y);
                }
            }

            // 与鼠标的连线（透明度随距离衰减，但统一一档批量画）
            if (mouse.x !== null) {
                var mx = d.x - mouse.x;
                var my = d.y - mouse.y;
                if (mx * mx + my * my < mouseSq) mouseSegs.push(d.x, d.y, mouse.x, mouse.y);
            }
        }

        // 批量描边：粒子之间
        for (var b = 0; b < BUCKETS; b++) {
            var seg = buckets[b];
            if (!seg.length) continue;
            ctx.strokeStyle = 'rgba(' + CONFIG.color + ',' +
                (((b + 0.5) / BUCKETS) * 0.55).toFixed(3) + ')';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (var k = 0; k < seg.length; k += 4) {
                ctx.moveTo(seg[k], seg[k + 1]);
                ctx.lineTo(seg[k + 2], seg[k + 3]);
            }
            ctx.stroke();
            seg.length = 0;          // 数组复用，不反复分配
        }

        // 批量描边：连到鼠标的线（更亮一点）
        if (mouseSegs.length) {
            ctx.strokeStyle = 'rgba(' + CONFIG.color + ',0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (var m = 0; m < mouseSegs.length; m += 4) {
                ctx.moveTo(mouseSegs[m], mouseSegs[m + 1]);
                ctx.lineTo(mouseSegs[m + 2], mouseSegs[m + 3]);
            }
            ctx.stroke();
            mouseSegs.length = 0;
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
