/*!
 * 文章标题打字机 —— 文章页顶部大图上的标题逐字打出来
 *
 * Butterfly 自带的 typed.js 只作用于【首页】的站点副标题（subtitle 配置），
 * 文章标题没有这个效果，所以单独写一个。
 *
 * 目标元素：#post-info h1.post-title（只在文章页存在，首页/归档/关于页都没有）
 * 打完光标会淡出，标题恢复干净；JS 失效时标题也照常显示（只是不打字）。
 */
(function () {
    'use strict';

    var CONFIG = {
        selector: '#post-info h1.post-title',
        speed: 95,           // 每个字的间隔（毫秒），长标题嫌慢就调小
        startDelay: 300,     // 页面加载后延迟多久开始（避开头部入场动画）
        keepCaret: false     // 打完是否保留闪烁光标
    };

    var el = document.querySelector(CONFIG.selector);
    if (!el) return;                                   // 非文章页
    if (el.getAttribute('data-si-typed')) return;      // 幂等

    var full = (el.textContent || '').trim();
    if (full.length < 2) return;                       // 太短就不折腾

    el.setAttribute('data-si-typed', '1');
    var caret = document.createElement('span');
    caret.className = 'si-title-caret';
    caret.setAttribute('aria-hidden', 'true');

    function render(text) {
        el.textContent = text;
        el.appendChild(caret);
    }

    var i = 0;
    render('');

    function step() {
        if (i >= full.length) return;
        i++;
        render(full.slice(0, i));
        if (i < full.length) {
            setTimeout(step, CONFIG.speed);
        } else if (!CONFIG.keepCaret) {
            caret.classList.add('si-caret-done');
            setTimeout(function () { if (caret.parentNode) caret.parentNode.removeChild(caret); }, 520);
        }
    }
    setTimeout(step, CONFIG.startDelay);

    // 兜底：万一中途卡住（切后台被浏览器限流等），强制补全，绝不留半截标题
    setTimeout(function () {
        if (i < full.length) {
            i = full.length;
            render(full);
            caret.classList.add('si-caret-done');
        }
    }, CONFIG.startDelay + full.length * CONFIG.speed + 3000);
})();
