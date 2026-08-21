/**
 * Loading states — provides consistent loading indicators.
 *
 * Shows skeleton UI for content areas and spinners for buttons.
 */

/**
 * Create a skeleton placeholder for content.
 * @param {string} type — 'text' | 'card' | 'list'
 */
export function createSkeleton(type = 'text') {
  const skeleton = document.createElement('div');
  skeleton.className = `skeleton skeleton-${type}`;
  skeleton.setAttribute('aria-hidden', 'true');

  switch (type) {
    case 'text':
      skeleton.innerHTML = `
        <div class="skeleton-line" style="width: 100%"></div>
        <div class="skeleton-line" style="width: 85%"></div>
        <div class="skeleton-line" style="width: 70%"></div>
      `;
      break;
    case 'card':
      skeleton.innerHTML = `
        <div class="skeleton-line" style="width: 60%; height: 16px"></div>
        <div class="skeleton-line" style="width: 100%; height: 12px; margin-top: 12px"></div>
        <div class="skeleton-line" style="width: 90%; height: 12px"></div>
        <div class="skeleton-line" style="width: 75%; height: 12px"></div>
      `;
      break;
    case 'list':
      skeleton.innerHTML = Array(5).fill(`
        <div class="skeleton-list-item">
          <div class="skeleton-line" style="width: 70%; height: 14px"></div>
          <div class="skeleton-line" style="width: 40%; height: 10px"></div>
        </div>
      `).join('');
      break;
  }

  return skeleton;
}

/**
 * Show a loading spinner inside a container.
 */
export function showSpinner(container, message = 'Loading…') {
  container.innerHTML = `
    <div class="ai-loading">
      <div class="spinner"></div>
      <div style="margin-top: 12px">${message}</div>
    </div>
  `;
}

/**
 * Add spinner and skeleton CSS.
 * Called once on init.
 */
export function initLoadingStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--line);
      border-top-color: var(--green);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .ai-loading {
      text-align: center;
      color: var(--muted);
      font-size: 12.5px;
      padding: 26px 0;
    }

    .skeleton {
      padding: 16px;
    }

    .skeleton-line {
      height: 12px;
      background: linear-gradient(90deg, var(--line) 25%, #e8ecec 50%, var(--line) 75%);
      background-size: 200% 100%;
      border-radius: 4px;
      animation: skeleton-pulse 1.5s ease-in-out infinite;
      margin-bottom: 10px;
    }

    .skeleton-list-item {
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
    }

    @keyframes skeleton-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner { animation: none; border-top-color: var(--green); }
      .skeleton-line { animation: none; }
    }
  `;
  document.head.appendChild(style);
}
