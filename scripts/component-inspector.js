
// Component Inspector - Click elements to select them
(function() {
  'use strict';

  let isEnabled = false;
  let currentHighlight = null;
  let originalCursor = '';
  let selectedElement = null; // Track if an element is selected

  const overlay = document.createElement('div');
  overlay.id = 'component-inspector-overlay';
  overlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid #0d00ff;
    background: rgba(13, 0, 255, 0.1);
    z-index: 999999;
    transition: all 0.1s ease;
    display: none;
  `;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    document.body.appendChild(overlay);
    setupEventListeners();

    // Request current inspector state from parent (handles HMR re-init)
    window.parent.postMessage({ type: 'INSPECTOR_REQUEST_STATE' }, '*');
  }

  function setupEventListeners() {
    window.addEventListener('message', handleMessage);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);
  }

  function handleMessage(event) {
    const { type, enabled } = event.data;

    if (type === 'INSPECTOR_TOGGLE') {
      isEnabled = enabled;

      if (enabled) {
        enableInspector();
      } else {
        disableInspector();
      }
    }
  }

  function enableInspector() {
    originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
  }

  function disableInspector() {
    document.body.style.cursor = originalCursor;
    overlay.style.display = 'none'; // Hide overlay when inspector is disabled
    currentHighlight = null;
    selectedElement = null; // Clear selection
  }

  function handleMouseMove(event) {
    if (!isEnabled) return;
    if (selectedElement) return; // Don't update highlight if element is selected

    const target = event.target;
    if (target === overlay || target === document.body || target === document.documentElement) {
      return;
    }

    highlightElement(target);
    currentHighlight = target;
  }

  function handleClick(event) {
    if (!isEnabled) return;

    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    if (target === overlay || target === document.body || target === document.documentElement) {
      return;
    }

    selectElement(target);
  }

  function highlightElement(element) {
    const rect = element.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + window.scrollY + 'px';
    overlay.style.left = rect.left + window.scrollX + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }

  function selectElement(element) {
    // Extract React Fiber data for accurate component detection
    let componentInfo = null;
    let parentComponentInfo = null;
    try {
      // Find React fiber key (varies by React version)
      const fiberKey = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
      if (fiberKey) {
        let fiber = element[fiberKey];
        let foundFirst = false;

        // Walk up the fiber tree to find components
        // Collect both immediate component AND parent component
        while (fiber) {
          if (fiber._debugSource) {
            const source = {
              fileName: fiber._debugSource.fileName,
              lineNumber: fiber._debugSource.lineNumber,
              columnNumber: fiber._debugSource.columnNumber,
            };

            // Check if this is a reusable UI component (in ui/ or components/ui/)
            const isUIComponent = source.fileName.includes('/ui/') || source.fileName.includes('/components/ui/');

            if (!foundFirst) {
              componentInfo = source;
              foundFirst = true;

              // If this is a UI component, keep looking for parent
              if (isUIComponent) {
                fiber = fiber.return;
                continue;
              } else {
                // Not a UI component, this is the actual usage site
                break;
              }
            } else if (!parentComponentInfo && !isUIComponent) {
              // Found parent component (not in ui folder)
              parentComponentInfo = source;
              break;
            }
          }
          fiber = fiber.return;
        }
      }
    } catch (err) {
      // Could not extract React Fiber data
    }

    // Use parent component if available (better for reusable components)
    const targetComponent = parentComponentInfo || componentInfo;

    // Extract clean text content (prefer innerText, fallback to textContent)
    let text = '';
    try {
      // innerText respects CSS and excludes hidden elements
      text = element.innerText || element.textContent || '';
      // Clean up: remove CSS/style content
      text = text.replace(/\{[^}]+\}/g, '').replace(/\[[^\]]+\]/g, '').trim();
      text = text.substring(0, 100);
    } catch (err) {
      text = element.textContent?.substring(0, 100) || '';
    }

    const elementInfo = {
      tagName: element.tagName.toLowerCase(),
      className: element.className || '',
      id: element.id || '',
      textContent: text,
      innerHTML: element.innerHTML?.substring(0, 500) || '',
      attributes: getRelevantAttributes(element),
      computedStyles: getRelevantStyles(element),
      path: getElementPath(element),
      componentInfo: targetComponent, // Use parent component for reusable UI components
    };

    // Keep element highlighted persistently
    selectedElement = element; // Mark this element as selected
    overlay.style.borderColor = '#0d00ff';
    overlay.style.background = 'rgba(13, 0, 255, 0.2)';
    overlay.style.borderWidth = '3px';

    window.parent.postMessage({
      type: 'INSPECTOR_ELEMENT_SELECTED',
      element: elementInfo,
    }, '*');
  }

  function getRelevantAttributes(element) {
    const attrs = {};
    const relevantAttrs = ['data-component', 'data-testid', 'role', 'aria-label', 'type', 'href', 'src'];

    relevantAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        attrs[attr] = element.getAttribute(attr);
      }
    });

    return attrs;
  }

  function getRelevantStyles(element) {
    const computed = window.getComputedStyle(element);
    const relevantStyles = [
      'backgroundColor',
      'color',
      'fontSize',
      'fontWeight',
      'borderRadius',
      'padding',
      'margin',
      'display',
      'flexDirection',
      'justifyContent',
      'alignItems',
    ];

    const styles = {};
    relevantStyles.forEach(prop => {
      const value = computed[prop];
      if (value && value !== 'none' && value !== 'normal') {
        styles[prop] = value;
      }
    });

    return styles;
  }

  function getElementPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += '#' + current.id;
      } else if (current.className) {
        const classes = current.className.split(' ').filter(c => c && !c.startsWith('_')).slice(0, 2);
        if (classes.length > 0) {
          selector += '.' + classes.join('.');
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
})();
