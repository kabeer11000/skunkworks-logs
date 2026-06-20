export default class DrainSidebarItem extends HTMLElement {
  constructor() {
    super();

    const shadowRoot = this.attachShadow({ mode: 'open' });

    // 1. Added class names so we can select these elements in updateContent()
    // 2. Removed hardcoded Google links/text
    shadowRoot.innerHTML = `
      <md-list-item type="link" class="list-item rounded-xl" href="#">
        <div slot="headline" class="title"></div>
        <div slot="supporting-text" class="description"></div>
        <md-icon slot="end" class="icon"></md-icon>
      </md-list-item>
    `;
  }

  connectedCallback() {
    this.updateContent();
  }

  // Observe the 'data-drain' attribute, as that's what we are passing in
  static get observedAttributes() {
    return ['data-drain'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateContent();
    }
  }

  updateContent() {
    const drainDataStr = this.getAttribute('data-drain');
    if (!drainDataStr) return;

    try {
      // Parse the JSON object passed into the attribute
      const drain = JSON.parse(drainDataStr);

      // Grab the DOM elements inside the shadow root
      const listItem = this.shadowRoot.querySelector('.list-item');
      const titleEl = this.shadowRoot.querySelector('.title');
      const descEl = this.shadowRoot.querySelector('.description');
      const iconEl = this.shadowRoot.querySelector('.icon');

      // Update text content safely
      titleEl.textContent = drain.title || 'Untitled';
      descEl.textContent = `Visibility: ${drain.visibility}`;

      // Dynamically set the href (e.g., routing to the drain's ID)
      if (drain.id) {
        listItem.setAttribute('href', `/drains/${drain.id}`); 
      }

      // Dynamically change icon based on visibility
      iconEl.textContent = drain.visibility === 'shared' ? 'public' : 'lock';

    } catch (error) {
      console.error('Failed to parse data-drain attribute:', error);
    }
  }
}

// Define the new element
if (!customElements.get('drain-sidebar-item')) {
  customElements.define('drain-sidebar-item', DrainSidebarItem);
}