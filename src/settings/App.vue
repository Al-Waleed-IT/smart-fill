<script setup>
import { ref, onMounted, computed } from 'vue'
import { storage } from '../utils/storage.js'

const settings = ref({
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
})

const saving = ref(false)
const saved = ref(false)
const showOpenAIKey = ref(false)
const showGeminiKey = ref(false)
const showPassword = ref(false)
const activeTab = ref('api')

const openaiModels = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cheap)' },
  { id: 'gpt-4o', name: 'GPT-4o (Best Quality)' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Fastest)' }
]

const geminiModels = [
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Latest)' },
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Best Quality)' },
  { id: 'gemini-pro', name: 'Gemini Pro' }
]

const currentApiKey = computed(() => {
  return settings.value.provider === 'openai'
    ? settings.value.openaiKey
    : settings.value.geminiKey
})

onMounted(async () => {
  const savedSettings = await storage.getSettings()
  settings.value = { ...settings.value, ...savedSettings }
})

async function saveSettings() {
  saving.value = true
  try {
    await storage.saveSettings(settings.value)
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
  } finally {
    saving.value = false
  }
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
    <div class="max-w-3xl mx-auto p-8">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-8">
        <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold">Smart Fill Settings</h1>
          <p class="text-slate-400">Configure your AI provider and profile</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-6">
        <button
          @click="activeTab = 'api'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'api' ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'"
        >
          API Settings
        </button>
        <button
          @click="activeTab = 'profile'"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="activeTab === 'profile' ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'"
        >
          User Profile
        </button>
      </div>

      <!-- API Settings Tab -->
      <div v-show="activeTab === 'api'" class="space-y-6">
        <!-- Provider Selection -->
        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">AI Provider</h2>
          <div class="grid grid-cols-2 gap-4">
            <button
              @click="settings.provider = 'openai'"
              class="p-4 rounded-xl border-2 transition-all text-left"
              :class="settings.provider === 'openai'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 hover:border-slate-500'"
            >
              <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <span class="font-bold text-lg">AI</span>
                </div>
                <span class="font-semibold">OpenAI</span>
              </div>
              <p class="text-sm text-slate-400">GPT-4o, GPT-4 Turbo, GPT-3.5</p>
            </button>

            <button
              @click="settings.provider = 'gemini'"
              class="p-4 rounded-xl border-2 transition-all text-left"
              :class="settings.provider === 'gemini'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 hover:border-slate-500'"
            >
              <div class="flex items-center gap-3 mb-2">
                <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span class="font-bold text-lg">G</span>
                </div>
                <span class="font-semibold">Google Gemini</span>
              </div>
              <p class="text-sm text-slate-400">Gemini 1.5 Flash, Pro</p>
            </button>
          </div>
        </div>

        <!-- OpenAI API Key -->
        <div v-if="settings.provider === 'openai'" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">OpenAI API Key</h2>
          <div class="relative">
            <input
              :type="showOpenAIKey ? 'text' : 'password'"
              v-model="settings.openaiKey"
              placeholder="sk-..."
              class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 pr-12"
            />
            <button
              @click="showOpenAIKey = !showOpenAIKey"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg v-if="showOpenAIKey" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p class="mt-2 text-sm text-slate-400">
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" class="text-blue-400 hover:underline">OpenAI Dashboard</a>
          </p>

          <!-- Model Selection -->
          <div class="mt-4">
            <label class="block text-sm font-medium mb-2">Model</label>
            <select
              v-model="settings.model"
              class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option v-for="model in openaiModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Gemini API Key -->
        <div v-if="settings.provider === 'gemini'" class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">Google Gemini API Key</h2>
          <div class="relative">
            <input
              :type="showGeminiKey ? 'text' : 'password'"
              v-model="settings.geminiKey"
              placeholder="AIza..."
              class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 pr-12"
            />
            <button
              @click="showGeminiKey = !showGeminiKey"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg v-if="showGeminiKey" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p class="mt-2 text-sm text-slate-400">
            Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-blue-400 hover:underline">Google AI Studio</a>
          </p>

          <!-- Gemini Model Selection -->
          <div class="mt-4">
            <label class="block text-sm font-medium mb-2">Model</label>
            <select
              v-model="settings.geminiModel"
              class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option v-for="model in geminiModels" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Profile Tab -->
      <div v-show="activeTab === 'profile'" class="space-y-6">
        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">Personal Information</h2>
          <p class="text-sm text-slate-400 mb-4">This information will be used to auto-fill forms</p>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">First Name</label>
              <input
                type="text"
                v-model="settings.userProfile.firstName"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Last Name</label>
              <input
                type="text"
                v-model="settings.userProfile.lastName"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                v-model="settings.userProfile.email"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Phone</label>
              <input
                type="tel"
                v-model="settings.userProfile.phone"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">Address</h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Street Address</label>
              <input
                type="text"
                v-model="settings.userProfile.address"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">City</label>
                <input
                  type="text"
                  v-model="settings.userProfile.city"
                  class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">State/Province</label>
                <input
                  type="text"
                  v-model="settings.userProfile.state"
                  class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">ZIP/Postal Code</label>
                <input
                  type="text"
                  v-model="settings.userProfile.zipCode"
                  class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">Country</label>
                <input
                  type="text"
                  v-model="settings.userProfile.country"
                  class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">Work</h2>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Company</label>
              <input
                type="text"
                v-model="settings.userProfile.company"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">Job Title</label>
              <input
                type="text"
                v-model="settings.userProfile.jobTitle"
                class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div class="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 class="text-lg font-semibold mb-4">Password</h2>
          <p class="text-sm text-slate-400 mb-4">
            Used when filling password fields. If left blank, a default password is used. Stored locally and never sent to the AI provider.
          </p>
          <div class="relative">
            <input
              :type="showPassword ? 'text' : 'password'"
              v-model="settings.userProfile.password"
              placeholder="Leave blank to use default"
              class="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 pr-12"
            />
            <button
              @click="showPassword = !showPassword"
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="mt-8 flex items-center gap-4">
        <button
          @click="saveSettings"
          :disabled="saving"
          class="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 rounded-lg font-medium transition-all flex items-center gap-2"
        >
          <svg v-if="saving" class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>

        <span v-if="saved" class="text-green-400 flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Settings saved!
        </span>
      </div>
    </div>
  </div>
</template>
