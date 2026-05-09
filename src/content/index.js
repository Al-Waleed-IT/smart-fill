// Content script for form detection and filling

// Store scanned fields for better matching
let scannedFields = []

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ success: true })
    return true
  }

  if (message.action === 'scanForms') {
    try {
      const fields = scanFormFields()
      scannedFields = fields // Store for later use
      sendResponse({ success: true, fields })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
    return true
  }

  if (message.action === 'fillForms') {
    try {
      const filledCount = fillFormFields(message.data)
      if (filledCount > 0) {
        showFilledIndicator(filledCount)
      }
      sendResponse({ success: true, filledCount })
    } catch (error) {
      console.error('Smart Fill error:', error)
      sendResponse({ success: false, error: error.message })
    }
    return true
  }

  return true
})

// Scan all form fields on the page
function scanFormFields() {
  const fields = []
  const selectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="url"]',
    'input[type="search"]',
    'input[type="password"]',
    'input:not([type])',
    'textarea',
    'select'
  ]

  const elements = document.querySelectorAll(selectors.join(', '))

  elements.forEach((el, index) => {
    // Skip hidden or disabled fields (password fields are now included)
    if (el.type === 'hidden' || el.disabled || !isVisible(el)) {
      return
    }

    const field = {
      id: el.id || '',
      name: el.name || '',
      type: el.type || el.tagName.toLowerCase(),
      label: getFieldLabel(el),
      placeholder: el.placeholder || '',
      autocomplete: el.autocomplete || '',
      required: el.required,
      tagName: el.tagName.toLowerCase(),
      index: index,
      context: getFieldContext(el)
    }

    // For select elements, include options
    if (el.tagName.toLowerCase() === 'select') {
      field.options = Array.from(el.options).map(opt => ({
        value: opt.value,
        text: opt.text
      }))
    }

    fields.push(field)
  })

  console.log('Smart Fill: Scanned fields:', fields)
  return fields
}

// Collect surrounding context that helps AI identify search/filter/pagination widgets
function getFieldContext(element) {
  const ctx = {}

  const form = element.closest('form')
  if (form) {
    ctx.formRole = form.getAttribute('role') || ''
    ctx.formAction = form.getAttribute('action') || ''
    ctx.formName = form.getAttribute('name') || form.id || ''
  }

  const searchAncestor = element.closest('[role="search"], [class*="search" i], [class*="filter" i], [class*="pagination" i], [class*="toolbar" i], [class*="datatable" i], [class*="data-table" i]')
  if (searchAncestor) {
    ctx.ancestorHint = (searchAncestor.getAttribute('class') || '') + ' ' + (searchAncestor.getAttribute('role') || '')
    ctx.ancestorHint = ctx.ancestorHint.trim().slice(0, 120)
  }

  return ctx
}

// Get the label for a form field
function getFieldLabel(element) {
  // Check for associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`)
    if (label) return label.textContent.trim()
  }

  // Check for parent label
  const parentLabel = element.closest('label')
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true)
    // Remove the input element from clone to get just the label text
    const inputs = clone.querySelectorAll('input, select, textarea')
    inputs.forEach(inp => inp.remove())
    return clone.textContent.trim()
  }

  // Check for aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label')
  }

  // Check for aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy)
    if (labelEl) return labelEl.textContent.trim()
  }

  // Check for preceding sibling label/span
  let prev = element.previousElementSibling
  while (prev) {
    if (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.tagName === 'DIV') {
      const text = prev.textContent.trim()
      if (text && text.length < 50) return text
    }
    prev = prev.previousElementSibling
  }

  // Check parent for label text
  const parent = element.parentElement
  if (parent) {
    const parentText = parent.textContent.trim()
    if (parentText && parentText.length < 50 && parentText !== element.value) {
      return parentText
    }
  }

  // Use placeholder or name as fallback
  return element.placeholder || element.name || ''
}

// Check if element is visible
function isVisible(element) {
  if (!element.offsetParent && element.style.position !== 'fixed') {
    return false
  }

  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  )
}

// Get all fillable elements
function getAllFillableElements() {
  const selectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="url"]',
    'input[type="search"]',
    'input[type="password"]',
    'input:not([type])',
    'textarea',
    'select'
  ]
  return Array.from(document.querySelectorAll(selectors.join(', ')))
    .filter(el => el.type !== 'hidden' && !el.disabled && isVisible(el))
}

// Fill form fields with AI-generated data
function fillFormFields(data) {
  console.log('Smart Fill: Received data to fill:', data)

  if (!data || typeof data !== 'object') {
    console.warn('Smart Fill: Invalid data received')
    return 0
  }

  const elements = getAllFillableElements()
  let filledCount = 0

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue

    let element = findElement(key, elements)

    if (element) {
      console.log(`Smart Fill: Filling "${key}" with "${value}"`)
      fillField(element, value)
      filledCount++
    } else {
      console.log(`Smart Fill: Could not find element for key "${key}"`)
    }
  }

  console.log(`Smart Fill: Filled ${filledCount} fields`)
  return filledCount
}

// Find element by various matching strategies
function findElement(key, elements) {
  const keyLower = key.toLowerCase().trim()
  // Remove common suffixes like * for required fields
  const keyClean = keyLower.replace(/\s*\*\s*$/, '').trim()

  // 1. Try exact ID match
  let element = document.getElementById(key)
  if (element && elements.includes(element)) return element

  // 2. Try exact name match
  try {
    element = document.querySelector(`[name="${CSS.escape(key)}"]`)
    if (element && elements.includes(element)) return element
  } catch (e) {}

  // 3. Try case-insensitive ID match
  element = elements.find(el => el.id && el.id.toLowerCase() === keyLower)
  if (element) return element

  // 4. Try case-insensitive name match
  element = elements.find(el => el.name && el.name.toLowerCase() === keyLower)
  if (element) return element

  // 5. PRIORITY: Try exact label match (most important for fields without id/name)
  element = elements.find(el => {
    const label = getFieldLabel(el).toLowerCase().trim()
    return label === keyLower || label === keyClean
  })
  if (element) return element

  // 6. Try label match without the * suffix
  element = elements.find(el => {
    const label = getFieldLabel(el).toLowerCase().replace(/\s*\*\s*$/, '').trim()
    return label === keyClean
  })
  if (element) return element

  // 7. Try partial label match
  element = elements.find(el => {
    const label = getFieldLabel(el).toLowerCase()
    return label.includes(keyClean) || keyClean.includes(label.replace(/\s*\*\s*$/, ''))
  })
  if (element) return element

  // 8. Try partial ID match
  element = elements.find(el => el.id && el.id.toLowerCase().includes(keyClean))
  if (element) return element

  // 9. Try partial name match
  element = elements.find(el => el.name && el.name.toLowerCase().includes(keyClean))
  if (element) return element

  // 10. Try matching by placeholder
  element = elements.find(el => {
    const placeholder = (el.placeholder || '').toLowerCase()
    return placeholder.includes(keyClean) || keyClean.includes(placeholder)
  })
  if (element) return element

  // 11. Try matching by autocomplete attribute
  element = elements.find(el => {
    const autocomplete = (el.autocomplete || '').toLowerCase()
    return autocomplete === keyClean || autocomplete.includes(keyClean)
  })
  if (element) return element

  // 12. Try common field name mappings
  const fieldMappings = {
    'firstname': ['first_name', 'fname', 'first', 'given-name', 'givenname'],
    'lastname': ['last_name', 'lname', 'last', 'family-name', 'familyname', 'surname'],
    'email': ['email', 'e-mail', 'mail', 'emailaddress'],
    'phone': ['phone', 'tel', 'telephone', 'mobile', 'phonenumber', 'phone_number'],
    'address': ['address', 'street', 'address1', 'street_address', 'streetaddress'],
    'city': ['city', 'town', 'locality'],
    'state': ['state', 'province', 'region'],
    'zip': ['zip', 'zipcode', 'postal', 'postalcode', 'postal_code'],
    'country': ['country', 'nation'],
    'company': ['company', 'organization', 'org', 'employer'],
    'jobtitle': ['jobtitle', 'job_title', 'title', 'position', 'role'],
    'product': ['product', 'productname', 'item', 'itemname'],
    'price': ['price', 'cost', 'amount'],
    'description': ['description', 'desc', 'details', 'notes']
  }

  for (const [canonical, aliases] of Object.entries(fieldMappings)) {
    const keyNorm = keyClean.replace(/[_\-\s]/g, '')
    if (keyNorm === canonical || keyNorm.includes(canonical)) {
      for (const alias of aliases) {
        element = elements.find(el => {
          const id = (el.id || '').toLowerCase().replace(/[_\-\s]/g, '')
          const name = (el.name || '').toLowerCase().replace(/[_\-\s]/g, '')
          const label = getFieldLabel(el).toLowerCase().replace(/[_\-\s\*]/g, '')
          const autocomplete = (el.autocomplete || '').toLowerCase().replace(/[_\-\s]/g, '')
          return id.includes(alias) || name.includes(alias) || label.includes(alias) || autocomplete.includes(alias)
        })
        if (element) return element
      }
    }
  }

  return null
}

// Fill a single field
function fillField(element, value) {
  const tagName = element.tagName.toLowerCase()

  // Focus the element first
  element.focus()

  if (tagName === 'select') {
    // Find matching option
    const options = Array.from(element.options)
    const valueLower = String(value).toLowerCase()
    const match = options.find(opt =>
      opt.value.toLowerCase() === valueLower ||
      opt.text.toLowerCase() === valueLower ||
      opt.value.toLowerCase().includes(valueLower) ||
      opt.text.toLowerCase().includes(valueLower)
    )
    if (match) {
      element.value = match.value
    }
  } else if (element.type === 'checkbox' || element.type === 'radio') {
    element.checked = Boolean(value)
  } else {
    // Clear existing value first
    element.value = ''
    // Set new value
    element.value = String(value)
  }

  // Trigger all relevant events for React, Vue, Angular, etc.
  element.dispatchEvent(new Event('focus', { bubbles: true }))
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  element.dispatchEvent(new Event('blur', { bubbles: true }))

  // For React specifically, we need to update the internal value tracker
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set

  if (tagName === 'input' && nativeInputValueSetter) {
    nativeInputValueSetter.call(element, String(value))
    element.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (tagName === 'textarea' && nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(element, String(value))
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }

  // Add visual feedback
  element.classList.add('smart-fill-filled')
  element.style.transition = 'background-color 0.3s, box-shadow 0.3s'
  element.style.backgroundColor = 'rgba(34, 197, 94, 0.15)'
  element.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.4)'

  setTimeout(() => {
    element.style.backgroundColor = ''
    element.style.boxShadow = ''
  }, 2000)
}

// Show filled indicator
function showFilledIndicator(count) {
  // Remove existing indicator if any
  const existing = document.getElementById('smart-fill-indicator')
  if (existing) existing.remove()

  const indicator = document.createElement('div')
  indicator.id = 'smart-fill-indicator'
  indicator.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: smartFillSlideIn 0.3s ease;
    ">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      Filled ${count} field${count !== 1 ? 's' : ''} with Smart Fill
    </div>
    <style>
      @keyframes smartFillSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `
  document.body.appendChild(indicator)

  setTimeout(() => {
    indicator.style.transition = 'opacity 0.3s, transform 0.3s'
    indicator.style.opacity = '0'
    indicator.style.transform = 'translateX(100%)'
    setTimeout(() => indicator.remove(), 300)
  }, 3000)
}

console.log('Smart Fill content script loaded')
