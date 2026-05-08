/**
 * Cat Controller - manages cat animation states and mood
 */

export class CatController {
  constructor() {
    this.container = document.getElementById('cat-container');
    this.speechBubble = document.getElementById('speech-bubble');
    this.speechText = document.getElementById('speech-text');
    this.currentState = 'idle';
    this.speechTimeout = null;

    this._loadCatSVG();
  }

  /**
   * Load cat SVG into the container
   */
  async _loadCatSVG() {
    try {
      const response = await fetch('assets/cat-sprite.svg');
      const svgText = await response.text();
      this.container.innerHTML = svgText;
    } catch (e) {
      console.error('[Cat] Failed to load SVG:', e);
      // Fallback: show a simple emoji cat
      this.container.innerHTML = '<div style="font-size:80px;text-align:center">🐱</div>';
    }
  }

  /**
   * Start talking animation
   */
  startTalking() {
    this.currentState = 'talking';
    this.container.classList.add('cat-container--talking');
  }

  /**
   * Stop talking animation, return to idle
   */
  stopTalking() {
    this.currentState = 'idle';
    this.container.classList.remove('cat-container--talking');
  }

  /**
   * Set cat mood
   * @param {string} mood - 'happy', 'sad', 'neutral'
   */
  setMood(mood) {
    // Remove all mood classes
    this.container.classList.remove(
      'cat-container--happy',
      'cat-container--sad',
      'cat-container--neutral'
    );
    // Add new mood class
    this.container.classList.add(`cat-container--${mood}`);
  }

  /**
   * Show speech bubble with text
   * @param {string} text - Text to display
   * @param {number} duration - How long to show (ms), 0 = manual hide
   */
  showSpeech(text, duration = 3000) {
    // Clear any existing timeout
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }

    this.speechText.textContent = text;
    this.speechBubble.classList.add('speech-bubble--visible');

    if (duration > 0) {
      this.speechTimeout = setTimeout(() => {
        this.hideSpeech();
      }, duration);
    }
  }

  /**
   * Hide speech bubble
   */
  hideSpeech() {
    this.speechBubble.classList.remove('speech-bubble--visible');
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
  }

  /**
   * Play a quick reaction animation
   * @param {string} type - 'happy', 'surprised', 'sleepy'
   */
  react(type) {
    switch (type) {
      case 'happy':
        this.setMood('happy');
        this.showSpeech('~');
        setTimeout(() => this.setMood('neutral'), 2000);
        break;
      case 'surprised':
        this.showSpeech('!?');
        break;
      case 'sleepy':
        this.showSpeech('zzZ...');
        break;
    }
  }
}
