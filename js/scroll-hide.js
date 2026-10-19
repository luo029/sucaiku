/* js / scroll-hide.js · 手机端滚动时收起右上角菜单按钮，避免遮挡视线 */
(function(){
  // 注入样式（只在这个文件里，不影响其他 CSS）
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 960px) {
      .menu-fab {
        transition: transform .25s ease, opacity .25s ease;
        will-change: transform, opacity;
      }
      .menu-fab.scroll-hidden {
        transform: translateY(-90px);
        opacity: 0;
        pointer-events: none;
      }
    }
  `;
  document.head.appendChild(style);

  let lastY = window.scrollY;
  let ticking = false;

  function onScroll(){
    const fab = document.querySelector('.menu-fab');
    if (!fab) return;

    const y = window.scrollY;

    // 页面顶部附近始终显示
    if (y < 80) {
      fab.classList.remove('scroll-hidden');
      lastY = y;
      return;
    }

    const delta = y - lastY;

    if (delta > 6) {
      // 向下滑 → 收起
      fab.classList.add('scroll-hidden');
    } else if (delta < -6) {
      // 向上滑 → 出现
      fab.classList.remove('scroll-hidden');
    }

    lastY = y;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();