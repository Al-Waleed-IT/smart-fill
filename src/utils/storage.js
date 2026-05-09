// Chrome storage utilities
export const storage = {
  async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve)
    })
  },

  async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, resolve)
    })
  },

  async getSettings() {
    const result = await this.get(['settings'])
    return result.settings || {
      provider: 'openai',
      openaiKey: '',
      geminiKey: '',
      model: 'gpt-4o-mini',
      geminiModel: 'gemini-2.0-flash-exp',
      userProfile: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        company: '',
        jobTitle: '',
        password: ''
      }
    }
  },

  // Fallback used when the user has not configured a password
  DEFAULT_PASSWORD: 'SmartFill@123',

  getPassword(settings) {
    const custom = settings?.userProfile?.password
    return custom && custom.length > 0 ? custom : this.DEFAULT_PASSWORD
  },

  async saveSettings(settings) {
    await this.set({ settings })
  }
}
