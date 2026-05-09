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

  // 1. Single-value inputs, textareas, selects
  const singleSelectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="url"]',
    'input[type="password"]',
    'input[type="date"]',
    'input[type="datetime-local"]',
    'input[type="time"]',
    'input[type="month"]',
    'input[type="week"]',
    'input[type="color"]',
    'input[type="range"]',
    'input:not([type])',
    'textarea',
    'select'
  ]
  document.querySelectorAll(singleSelectors.join(', ')).forEach((el, index) => {
    if (el.type === 'hidden' || el.disabled || !isVisible(el)) return

    const field = {
      id: el.id || '',
      name: el.name || '',
      type: el.type || el.tagName.toLowerCase(),
      label: getFieldLabel(el),
      placeholder: el.placeholder || '',
      autocomplete: el.autocomplete || '',
      required: el.required,
      tagName: el.tagName.toLowerCase(),
      index,
      context: getFieldContext(el)
    }

    if (el.min) field.min = el.min
    if (el.max) field.max = el.max
    if (el.step) field.step = el.step
    if (el.pattern) field.pattern = el.pattern
    if (el.maxLength > 0) field.maxLength = el.maxLength
    if (el.minLength > 0) field.minLength = el.minLength

    if (el.tagName.toLowerCase() === 'select') {
      field.options = Array.from(el.options).map(opt => ({
        value: opt.value,
        text: opt.text
      }))
    }

    fields.push(field)
  })

  // 2. Radio groups — collapse all radios sharing a name into one field
  const seenRadio = new Set()
  document.querySelectorAll('input[type="radio"]').forEach((el, index) => {
    if (el.disabled || !isVisible(el)) return
    const name = el.name
    if (!name || seenRadio.has(name)) return
    seenRadio.add(name)

    const groupEls = Array.from(document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`))
      .filter(r => !r.disabled && isVisible(r))
    if (!groupEls.length) return

    fields.push({
      id: groupEls[0].id || '',
      name,
      type: 'radio',
      label: getRadioGroupLabel(groupEls[0]) || getFieldLabel(groupEls[0]),
      placeholder: '',
      autocomplete: groupEls[0].autocomplete || '',
      required: groupEls.some(r => r.required),
      tagName: 'input',
      index,
      context: getFieldContext(groupEls[0]),
      options: groupEls.map(r => ({ value: r.value, text: getFieldLabel(r) || r.value }))
    })
  })

  // 3. Checkboxes — group by name, or expose single ones as boolean fields
  const seenCheckboxName = new Set()
  document.querySelectorAll('input[type="checkbox"]').forEach((el, index) => {
    if (el.disabled || !isVisible(el)) return
    const name = el.name

    if (name && seenCheckboxName.has(name)) return
    if (name) seenCheckboxName.add(name)

    const groupEls = name
      ? Array.from(document.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(name)}"]`))
          .filter(c => !c.disabled && isVisible(c))
      : [el]
    if (!groupEls.length) return

    if (groupEls.length > 1) {
      fields.push({
        id: groupEls[0].id || '',
        name,
        type: 'checkbox-group',
        label: getRadioGroupLabel(groupEls[0]) || getFieldLabel(groupEls[0]),
        placeholder: '',
        autocomplete: '',
        required: groupEls.some(c => c.required),
        tagName: 'input',
        index,
        context: getFieldContext(groupEls[0]),
        options: groupEls.map(c => ({ value: c.value, text: getFieldLabel(c) || c.value }))
      })
    } else {
      fields.push({
        id: el.id || '',
        name: el.name || '',
        type: 'checkbox',
        label: getFieldLabel(el),
        placeholder: '',
        autocomplete: el.autocomplete || '',
        required: el.required,
        tagName: 'input',
        index,
        context: getFieldContext(el)
      })
    }
  })

  console.log('Smart Fill: Scanned fields:', fields)
  return fields
}

// Resolve a label for a radio/checkbox group. Tries (in order):
//  1. fieldset > legend
//  2. role="radiogroup"/role="group" with aria-labelledby / aria-label
//  3. The smallest common ancestor of all inputs sharing the name; from there,
//     walk up to 5 levels looking for a sibling/child label-ish element that
//     is NOT one of the per-option labels.
function getRadioGroupLabel(element) {
  const fieldset = element.closest('fieldset')
  if (fieldset) {
    const legend = fieldset.querySelector('legend')
    if (legend) {
      const text = legend.textContent.trim()
      if (text) return text
    }
  }

  const group = element.closest('[role="radiogroup"], [role="group"]')
  if (group) {
    const labelledBy = group.getAttribute('aria-labelledby')
    if (labelledBy) {
      const text = labelledBy.split(/\s+/)
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(' ')
        .trim()
      if (text) return text
    }
    const ariaLabel = group.getAttribute('aria-label')
    if (ariaLabel) return ariaLabel.trim()
  }

  const name = element.name
  const type = element.type
  if (!name) return ''

  let groupEls
  try {
    groupEls = Array.from(
      document.querySelectorAll(`input[type="${type}"][name="${CSS.escape(name)}"]`)
    )
  } catch {
    return ''
  }
  if (groupEls.length < 2) return ''

  const groupIds = new Set(groupEls.map(el => el.id).filter(Boolean))
  const isOptionLabel = (el) => {
    if (!el) return true
    const forId = el.getAttribute && el.getAttribute('for')
    if (forId && groupIds.has(forId)) return true
    return groupEls.some(r => el.contains && el.contains(r))
  }
  const looksLikeLabel = (el) => {
    if (!el || !el.tagName) return false
    if (el.tagName === 'LABEL' || el.tagName === 'LEGEND') return true
    if (/^H[1-6]$/.test(el.tagName)) return true
    return /(label|title|question|legend|prompt)/i.test(el.className || '')
  }
  const cleanText = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()

  let container = element.parentElement
  while (container && !groupEls.every(el => container.contains(el))) {
    container = container.parentElement
  }
  if (!container) return ''

  let scope = container
  for (let depth = 0; depth < 5 && scope; depth++) {
    // Label-ish elements among the first few children of scope
    let scanned = 0
    for (const child of scope.children) {
      if (scanned >= 5) break
      scanned++
      if (!looksLikeLabel(child)) continue
      if (isOptionLabel(child)) continue
      const text = cleanText(child)
      if (text && text.length < 200) return text
    }

    // Preceding siblings of scope
    let prev = scope.previousElementSibling
    let count = 0
    while (prev && count < 4) {
      if (looksLikeLabel(prev) && !isOptionLabel(prev)) {
        const text = cleanText(prev)
        if (text && text.length < 200) return text
      }
      prev = prev.previousElementSibling
      count++
    }

    scope = scope.parentElement
  }

  return ''
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
    'input[type="password"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="date"]',
    'input[type="datetime-local"]',
    'input[type="time"]',
    'input[type="month"]',
    'input[type="week"]',
    'input[type="color"]',
    'input[type="range"]',
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
  const groups = collectRadioCheckboxGroups()
  let filledCount = 0

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === '') continue

    // Radio / checkbox-group fills are handled before generic findElement
    // because findElement could otherwise pick a single radio/checkbox by
    // name and toggle it incorrectly via Boolean(value).
    const groupResult = fillRadioOrCheckboxGroup(key, value, groups)
    if (groupResult.matched) {
      if (groupResult.filled) {
        console.log(`Smart Fill: Filled group "${key}" with "${JSON.stringify(value)}"`)
        filledCount++
      } else {
        console.log(`Smart Fill: Matched group "${key}" but value "${value}" not found in options`)
      }
      continue
    }

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

// Build maps of visible radio and checkbox groups keyed by name
function collectRadioCheckboxGroups() {
  const radio = new Map()
  const checkbox = new Map()

  document.querySelectorAll('input[type="radio"]').forEach(el => {
    if (el.disabled || !isVisible(el) || !el.name) return
    if (!radio.has(el.name)) radio.set(el.name, [])
    radio.get(el.name).push(el)
  })

  document.querySelectorAll('input[type="checkbox"]').forEach(el => {
    if (el.disabled || !isVisible(el)) return
    const key = el.name || (el.id ? `__id__${el.id}` : null)
    if (!key) return
    if (!checkbox.has(key)) checkbox.set(key, [])
    checkbox.get(key).push(el)
  })

  return { radio, checkbox }
}

// Try to fill a radio group or checkbox group/single matching `key`.
// Returns { matched: bool, filled: bool }.
function fillRadioOrCheckboxGroup(key, value, groups) {
  const matched = matchGroupName(key, groups)
  if (!matched) return { matched: false, filled: false }

  const inputs = matched.elements

  if (matched.kind === 'radio') {
    const target = matchGroupOption(inputs, value)
    if (!target) return { matched: true, filled: false }
    target.checked = true
    fireGroupEvents(target)
    flashGroupFeedback(target)
    return { matched: true, filled: true }
  }

  // Single checkbox → boolean
  if (inputs.length === 1) {
    const truthy = isTruthyCheckboxValue(value)
    if (inputs[0].checked !== truthy) {
      inputs[0].checked = truthy
      fireGroupEvents(inputs[0])
    }
    flashGroupFeedback(inputs[0])
    return { matched: true, filled: true }
  }

  // Checkbox group → may be array of values, single value, or boolean-all
  const values = Array.isArray(value) ? value : [value]
  let any = false
  for (const v of values) {
    const target = matchGroupOption(inputs, v)
    if (!target) continue
    if (!target.checked) {
      target.checked = true
      fireGroupEvents(target)
    }
    flashGroupFeedback(target)
    any = true
  }
  return { matched: true, filled: any }
}

function matchGroupName(key, { radio, checkbox }) {
  const keyLower = String(key).toLowerCase().trim()
  const tryMap = (map, kind) => {
    if (map.has(key)) return { kind, name: key, elements: map.get(key) }
    for (const [name, els] of map) {
      if (name.toLowerCase() === keyLower) return { kind, name, elements: els }
    }
    for (const [name, els] of map) {
      const nl = name.toLowerCase()
      if (nl && (nl.includes(keyLower) || keyLower.includes(nl))) {
        return { kind, name, elements: els }
      }
    }
    for (const [name, els] of map) {
      const lbl = (getRadioGroupLabel(els[0]) || getFieldLabel(els[0]))
        .toLowerCase().replace(/\*/g, '').trim()
      if (!lbl) continue
      if (lbl === keyLower || lbl.includes(keyLower) || keyLower.includes(lbl)) {
        return { kind, name, elements: els }
      }
    }
    return null
  }
  return tryMap(radio, 'radio') || tryMap(checkbox, 'checkbox')
}

function matchGroupOption(inputs, value) {
  const valueLower = String(value).toLowerCase().trim()
  return inputs.find(el => {
    const v = String(el.value || '').toLowerCase().trim()
    const lbl = getFieldLabel(el).toLowerCase().trim()
    return v === valueLower
      || lbl === valueLower
      || (v && (v.includes(valueLower) || valueLower.includes(v)))
      || (lbl && (lbl.includes(valueLower) || valueLower.includes(lbl)))
  })
}

function isTruthyCheckboxValue(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const s = String(value).toLowerCase().trim()
  return ['true', 'yes', 'y', '1', 'on', 'checked', 'agree', 'accept'].includes(s)
}

function fireGroupEvents(el) {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new Event('click', { bubbles: true }))
}

function flashGroupFeedback(el) {
  el.classList.add('smart-fill-filled')
  el.style.transition = 'box-shadow 0.3s'
  el.style.boxShadow = '0 0 0 2px rgba(34, 197, 94, 0.6)'
  setTimeout(() => { el.style.boxShadow = '' }, 2000)
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
