<script setup>
import { ref, onMounted } from 'vue'
import { storage } from '../utils/storage.js'

const status = ref('idle') // idle, scanning, filling, success, error
const message = ref('')
const formFields = ref([])
const settings = ref(null)
const hasApiKey = ref(false)

onMounted(async () => {
  settings.value = await storage.getSettings()
  hasApiKey.value = !!(settings.value.openaiKey || settings.value.geminiKey)
})

// Inject content script if not already present
async function ensureContentScript(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' })
    return true
  } catch (error) {
    // Content script not loaded, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      })
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content.css']
      })
      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100))
      return true
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError)
      return false
    }
  }
}

async function scanForms() {
  status.value = 'scanning'
  message.value = 'Scanning page for forms...'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Check if we can run on this page
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot scan forms on this page type')
    }

    // Ensure content script is loaded
    const scriptReady = await ensureContentScript(tab.id)
    if (!scriptReady) {
      throw new Error('Could not load form scanner on this page')
    }

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanForms' })

    if (response && response.success) {
      formFields.value = response.fields
      if (response.fields.length === 0) {
        message.value = 'No form fields found on this page'
      } else {
        message.value = `Found ${response.fields.length} form fields`
      }
      status.value = 'idle'
    } else {
      throw new Error(response?.error || 'Failed to scan forms')
    }
  } catch (error) {
    status.value = 'error'
    message.value = error.message || 'Failed to scan page'
  }
}

async function fillForms() {
  if (!hasApiKey.value) {
    message.value = 'Please configure API key in settings first'
    status.value = 'error'
    return
  }

  status.value = 'filling'
  message.value = 'Generating form data with AI...'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Check if we can run on this page
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      throw new Error('Cannot fill forms on this page type')
    }

    // Ensure content script is loaded
    const scriptReady = await ensureContentScript(tab.id)
    if (!scriptReady) {
      throw new Error('Could not load form filler on this page')
    }

    // First scan for forms if not already done
    if (formFields.value.length === 0) {
      const scanResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scanForms' })
      if (!scanResponse || !scanResponse.success || scanResponse.fields.length === 0) {
        throw new Error('No forms found on this page')
      }
      formFields.value = scanResponse.fields
    }

    // Send to background for AI processing
    const response = await chrome.runtime.sendMessage({
      action: 'generateAndFill',
      fields: formFields.value
    })

    if (response && response.success) {
      // Send fill command to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'fillForms',
        data: response.data
      })

      status.value = 'success'
      message.value = 'Forms filled successfully!'
    } else {
      throw new Error(response?.error || 'Failed to generate form data')
    }
  } catch (error) {
    status.value = 'error'
    message.value = error.message || 'Failed to fill forms'
  }
}

function openSettings() {
  chrome.runtime.openOptionsPage()
}
</script>

<template>
  <div class="w-80 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 class="text-lg font-bold">Smart Fill</h1>
      </div>
      <button
        @click="openSettings"
        class="p-2 hover:bg-white/10 rounded-lg transition-colors"
        title="Settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- API Key Warning -->
    <div v-if="!hasApiKey" class="mb-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg">
      <p class="text-amber-200 text-sm">
        No API key configured. Please add your OpenAI or Gemini key in settings.
      </p>
    </div>

    <!-- Status Message -->
    <div v-if="message" class="mb-4 p-3 rounded-lg" :class="{
      'bg-blue-500/20 border border-blue-500/50': status === 'scanning' || status === 'filling',
      'bg-green-500/20 border border-green-500/50': status === 'success',
      'bg-red-500/20 border border-red-500/50': status === 'error',
      'bg-slate-700': status === 'idle'
    }">
      <p class="text-sm">{{ message }}</p>
    </div>

    <!-- Form Fields Preview -->
    <div v-if="formFields.length > 0" class="mb-4 max-h-32 overflow-y-auto">
      <p class="text-xs text-slate-400 mb-2">Detected fields:</p>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="field in formFields.slice(0, 10)"
          :key="field.id"
          class="px-2 py-1 bg-slate-700 rounded text-xs"
        >
          {{ field.label || field.name || field.type }}
        </span>
        <span v-if="formFields.length > 10" class="px-2 py-1 bg-slate-700 rounded text-xs">
          +{{ formFields.length - 10 }} more
        </span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="space-y-2">
      <button
        @click="scanForms"
        :disabled="status === 'scanning' || status === 'filling'"
        class="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" :class="{ 'animate-spin': status === 'scanning' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {{ status === 'scanning' ? 'Scanning...' : 'Scan Page' }}
      </button>

      <button
        @click="fillForms"
        :disabled="status === 'scanning' || status === 'filling' || !hasApiKey"
        class="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" :class="{ 'animate-pulse': status === 'filling' }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {{ status === 'filling' ? 'Filling...' : 'Auto Fill with AI' }}
      </button>
    </div>

    <!-- Footer -->
    <div class="mt-4 pt-3 border-t border-slate-700">
      <p class="text-xs text-slate-500 text-center">
        Powered by {{ settings?.provider === 'gemini' ? 'Google Gemini' : 'OpenAI' }}
      </p>
    </div>
  </div>
</template>
