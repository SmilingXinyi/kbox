const FORM_CONTROL_SELECTOR = 'input, textarea, select';

/**
 * With a fixed app shell, the iOS/Android keyboard can cover the focused field.
 * Scroll the control into the visual viewport after the keyboard animation settles.
 */
export function registerMobileFormFocus(): () => void {
    if (typeof window === 'undefined') {
        return () => undefined;
    }

    let timer = 0;

    const scrollFocusedIntoView = (target: HTMLElement) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            const visual = window.visualViewport;
            if (visual) {
                const rect = target.getBoundingClientRect();
                const visibleBottom = visual.offsetTop + visual.height;
                const visibleTop = visual.offsetTop;
                const margin = 24;
                if (rect.top >= visibleTop + margin && rect.bottom <= visibleBottom - margin) {
                    return;
                }
            }
            target.scrollIntoView({block: 'center', inline: 'nearest', behavior: 'smooth'});
        }, 350);
    };

    const onFocusIn = (event: FocusEvent) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches(FORM_CONTROL_SELECTOR)) return;
        if (target instanceof HTMLInputElement) {
            const type = target.type;
            if (
                type === 'checkbox' ||
                type === 'radio' ||
                type === 'range' ||
                type === 'file' ||
                type === 'button' ||
                type === 'submit' ||
                type === 'reset' ||
                type === 'hidden' ||
                type === 'image' ||
                type === 'color'
            ) {
                return;
            }
        }
        scrollFocusedIntoView(target);
    };

    const onViewportResize = () => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return;
        if (!active.matches(FORM_CONTROL_SELECTOR)) return;
        scrollFocusedIntoView(active);
    };

    document.addEventListener('focusin', onFocusIn);
    window.visualViewport?.addEventListener('resize', onViewportResize);
    window.visualViewport?.addEventListener('scroll', onViewportResize);

    return () => {
        window.clearTimeout(timer);
        document.removeEventListener('focusin', onFocusIn);
        window.visualViewport?.removeEventListener('resize', onViewportResize);
        window.visualViewport?.removeEventListener('scroll', onViewportResize);
    };
}
