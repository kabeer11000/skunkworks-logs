import '@material/web/dialog/dialog.js';
import '@material/web/button/text-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/textfield/outlined-text-field.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';

type Visibility = 'shared' | 'private';
type Step = 'setup' | 'key-shown';

// Extend standard HTMLElement
export class NewDrainDialog extends HTMLElement {
  // Internal state
  private _open = false;
  private _visibility: Visibility = 'shared';
  private _drainTitle = '';
  private _generatedKey = '';
  private _step: Step = 'setup';

  // DOM References
  private _dialog!: HTMLElement & { open: boolean };

  static get observedAttributes() {
    return ['open', 'drain-title'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Bind global event handler so it can be cleanly removed
    this._handleOpenRequest = this._handleOpenRequest.bind(this);
    
    // Inject initial styles and the base dialog element
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: contents;
        }
        p {
          color: var(--md-sys-color-on-surface-variant);
          font-size: 0.9rem;
          margin: 0 0 16px;
        }
        .field {
          margin-bottom: 16px;
        }
        .field md-outlined-text-field {
          width: 100%;
        }
        .vis-label {
          display: block;
          margin-bottom: 6px;
          color: var(--md-sys-color-on-surface-variant);
          font-size: 0.85rem;
        }
        .vis-options {
          display: flex;
          gap: 12px;
        }
        .vis-option {
          flex: 1;
          padding: 12px;
          border: 1px solid var(--md-sys-color-outline);
          border-radius: 8px;
          cursor: pointer;
          text-align: center;
          transition: border-color 0.15s, background 0.15s;
        }
        .vis-option.selected {
          border-color: var(--md-sys-color-primary);
          background: var(--md-sys-color-secondary-container);
        }
        .vis-option .label {
          font-weight: 600;
          margin-bottom: 4px;
          color: var(--md-sys-color-on-surface);
        }
        .vis-option .desc {
          font-size: 0.75rem;
          color: var(--md-sys-color-on-surface-variant);
        }
        .key-box {
          background: var(--md-sys-color-surface-variant);
          border-radius: 6px;
          padding: 12px;
          margin-top: 12px;
          font-family: monospace;
          font-size: 0.8rem;
          word-break: break-all;
          cursor: pointer;
        }
        .warning {
          background: var(--md-sys-color-error-container);
          color: var(--md-sys-color-on-error-container);
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
          font-size: 0.85rem;
        }
      </style>
      <md-dialog></md-dialog>
    `;

    this._dialog = this.shadowRoot!.querySelector('md-dialog') as HTMLElement & { open: boolean };

    // Sync `<md-dialog>` native close event with component state
    this._dialog.addEventListener('close', () => {
      this.open = false;
    });
  }

  // --- Lifecycle Methods ---

  connectedCallback(): void {
    window.addEventListener('request-new-drain', this._handleOpenRequest);
    this._renderStep(); // Render the initial step
  }

  disconnectedCallback(): void {
    window.removeEventListener('request-new-drain', this._handleOpenRequest);
  }

  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null): void {
    if (name === 'open') {
      this.open = newVal !== null;
    } else if (name === 'drain-title') {
      this.drainTitle = newVal || '';
    }
  }

  // --- Getters & Setters ---

  get open(): boolean { return this._open; }
  set open(val: boolean) {
    if (this._open === val) return;
    this._open = val;
    
    // Reflect boolean to attribute
    if (val) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
    
    // Sync with Material Dialog
    if (this._dialog) {
      this._dialog.open = val;
    }
  }

  get visibility(): Visibility { return this._visibility; }
  set visibility(val: Visibility) {
    if (this._visibility === val) return;
    this._visibility = val;
    this._updateVisibilityUI();
  }

  get drainTitle(): string { return this._drainTitle; }
  set drainTitle(val: string) {
    this._drainTitle = val;
    const input = this._dialog.querySelector('md-outlined-text-field') as MdOutlinedTextField | null;
    if (input && input.value !== val) {
      input.value = val;
    }
  }

  get generatedKey(): string { return this._generatedKey; }
  set generatedKey(val: string) {
    this._generatedKey = val;
    const keyBox = this._dialog.querySelector('.key-box');
    if (keyBox) {
      keyBox.textContent = val;
    }
  }

  get step(): Step { return this._step; }
  set step(val: Step) {
    if (this._step === val) return;
    this._step = val;
    this._renderStep();
  }

  // --- Logic & Event Handlers ---

  private _handleOpenRequest(): void {
    this.step = 'setup';
    this.drainTitle = '';
    this.generatedKey = '';
    this.visibility = 'shared';
    this.open = true;
  }

  private async _create(): Promise<void> {
    // Ensure we grab the latest input value directly from the DOM before creating
    const input = this._dialog.querySelector('md-outlined-text-field') as MdOutlinedTextField | null;
    if (input) {
      this._drainTitle = input.value;
    }

    const title = this.drainTitle.trim() || 'Untitled';
    let key: string | null = null;

    if (this.visibility === 'private') {
      const { generateNotebookKey } = await import('@/services/crypto.js');
      key = await generateNotebookKey();
      this.generatedKey = key;
    }

    this.dispatchEvent(
      new CustomEvent('drain-created', {
        detail: { visibility: this.visibility, title, key },
        bubbles: true,
        composed: true,
      })
    );

    if (key) {
      this.step = 'key-shown';
    } else {
      this.open = false;
    }
  }

  private _copyKey(): void {
    navigator.clipboard.writeText(this.generatedKey);
  }

  // --- Manual DOM Rendering ---

  private _updateVisibilityUI(): void {
    const sharedOpt = this._dialog.querySelector('#vis-shared');
    const privateOpt = this._dialog.querySelector('#vis-private');

    if (sharedOpt && privateOpt) {
      if (this.visibility === 'shared') {
        sharedOpt.classList.add('selected');
        privateOpt.classList.remove('selected');
      } else {
        sharedOpt.classList.remove('selected');
        privateOpt.classList.add('selected');
      }
    }
  }

  private _renderStep(): void {
    if (!this._dialog) return;

    if (this._step === 'setup') {
      // Replaces inner HTML, wiping out old event listeners (avoids memory leaks)
      this._dialog.innerHTML = `
        <div slot="headline">New Drain</div>
        <div slot="content">
          <p>Create a new drain for your changelog entries.</p>
          <div class="field">
            <md-outlined-text-field label="Title" placeholder="Release notes"></md-outlined-text-field>
          </div>
          <span class="vis-label">Visibility</span>
          <div class="vis-options">
            <div id="vis-shared" class="vis-option ${this.visibility === 'shared' ? 'selected' : ''}">
              <div class="label">Shared</div>
              <div class="desc">Anyone can read &amp; write</div>
            </div>
            <div id="vis-private" class="vis-option ${this.visibility === 'private' ? 'selected' : ''}">
              <div class="label">Private</div>
              <div class="desc">End-to-end encrypted</div>
            </div>
          </div>
        </div>
        <div slot="actions">
          <md-text-button id="btn-cancel">Cancel</md-text-button>
          <md-filled-button id="btn-create">Create</md-filled-button>
        </div>
      `;

      // Assign dynamic properties safely via DOM references (prevents XSS vs string interpolation)
      const titleInput = this._dialog.querySelector('md-outlined-text-field') as MdOutlinedTextField;
      titleInput.value = this.drainTitle;

      // Attach Event Listeners
      titleInput.addEventListener('input', (e: Event) => {
        this._drainTitle = (e.target as MdOutlinedTextField).value;
      });

      this._dialog.querySelector('#vis-shared')?.addEventListener('click', () => this.visibility = 'shared');
      this._dialog.querySelector('#vis-private')?.addEventListener('click', () => this.visibility = 'private');
      this._dialog.querySelector('#btn-cancel')?.addEventListener('click', () => this.open = false);
      this._dialog.querySelector('#btn-create')?.addEventListener('click', () => this._create());

    } else if (this._step === 'key-shown') {
      this._dialog.innerHTML = `
        <div slot="headline">Save Your Private Key</div>
        <div slot="content">
          <p>
            Copy this key and store it safely. You will need it to access this drain on
            other devices. It cannot be recovered.
          </p>
          <div class="key-box" title="Click to copy"></div>
          <div class="warning">
            This key will never be shown again. If you lose it, your drain data is
            permanently inaccessible.
          </div>
        </div>
        <div slot="actions">
          <md-filled-button id="btn-done">Done</md-filled-button>
        </div>
      `;

      // Safe property assignment
      const keyBox = this._dialog.querySelector('.key-box') as HTMLElement;
      keyBox.textContent = this.generatedKey;

      // Attach Event Listeners
      keyBox.addEventListener('click', () => this._copyKey());
      this._dialog.querySelector('#btn-done')?.addEventListener('click', () => this.open = false);
    }
  }
}

customElements.define('new-drain-dialog', NewDrainDialog);

declare global {
  interface HTMLElementTagNameMap {
    'new-drain-dialog': NewDrainDialog;
  }
}