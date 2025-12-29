# Smart Fill - AI-Powered Form Auto-Filler Chrome Extension

[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome-green?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?logo=vuedotjs)](https://vuejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Automatically fill web forms with AI using OpenAI GPT-4o or Google Gemini. Save time on repetitive form filling with intelligent auto-completion powered by large language models.

## Table of Contents

- [Features](#features)
- [Supported AI Models](#supported-ai-models)
- [Installation](#installation)
- [Commands](#commands)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Security & Privacy](#security--privacy)
- [FAQ](#faq)
- [License](#license)

## Features

- **AI-Powered Form Auto-Fill** - Intelligently fills web forms using OpenAI GPT or Google Gemini AI models
- **Smart Field Detection** - Automatically scans and detects form fields on any webpage
- **Multiple AI Providers** - Choose between OpenAI and Google Gemini based on your preference
- **User Profile Storage** - Save your personal information locally for quick form completion
- **Model Selection** - Pick from various AI models (GPT-4o, GPT-4o Mini, Gemini 1.5 Flash, etc.)
- **Visual Feedback** - See which fields were filled with smooth highlight animations
- **Privacy-Focused** - All data stored locally in your browser, no external servers

## Supported AI Models

| Provider | Models | Best For |
|----------|--------|----------|
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 | High accuracy, complex forms |
| **Google Gemini** | Gemini 1.5 Flash, Gemini 1.5 Pro | Fast responses, cost-effective |

## Installation

### Prerequisites

- Node.js 18+ and npm
- Google Chrome browser

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/Al-Waleed-IT/smart-fill.git
cd smart-fill
```

2. **Install dependencies**
```bash
npm install
```

3. **Generate extension icons**
```bash
npm run icons
```

4. **Build the extension**
```bash
npm run build
```

5. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions`
   - Enable **Developer mode** (toggle in top right corner)
   - Click **Load unpacked**
   - Select the `dist` folder from the project

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build extension for production |
| `npm run build:vite` | Build with Vite only (without post-processing) |
| `npm run icons` | Generate PNG icons from SVG source |
| `npm run preview` | Preview production build locally |

## Configuration

### Setting Up Your AI Provider

1. Click the **Smart Fill** extension icon in Chrome toolbar
2. Click the **settings icon** (gear) in the popup
3. Select your preferred **AI Provider** (OpenAI or Google Gemini)
4. Enter your **API key**:
   - **OpenAI**: Get your key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Google Gemini**: Get your key from [Google AI Studio](https://aistudio.google.com/app/apikey)
5. Choose your preferred **AI model**
6. Click **Save Settings**

### User Profile Setup

Store your information for automatic form filling:

| Category | Fields |
|----------|--------|
| **Personal** | Name, Email, Phone |
| **Address** | Street, City, State, ZIP Code, Country |
| **Work** | Company Name, Job Title |

## Usage

### How to Auto-Fill Forms

1. **Navigate** to any webpage with a form (login, registration, contact, checkout, etc.)
2. **Click** the Smart Fill extension icon
3. **Scan Page** - Click to detect all fillable form fields
4. **Auto Fill with AI** - Click to intelligently fill the detected fields

The extension will use your saved profile data and AI to complete forms accurately.

## Project Structure

```
smart-fill/
├── src/
│   ├── popup/          # Extension popup UI (Vue)
│   ├── settings/       # Settings page (Vue)
│   ├── content/        # Content script for form detection
│   ├── background/     # Service worker for AI API calls
│   ├── utils/          # Shared utility functions
│   └── assets/         # CSS styles
├── public/
│   └── icons/          # Extension icons (16x16, 48x48, 128x128)
├── scripts/
│   └── build.js        # Custom build script
├── manifest.json       # Chrome Extension Manifest V3
├── vite.config.js      # Vite configuration
└── package.json        # Project dependencies
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Vue 3** | Frontend UI framework |
| **Tailwind CSS 4** | Utility-first CSS styling |
| **Vite** | Fast build tool and dev server |
| **Chrome Extension Manifest V3** | Latest extension architecture |
| **OpenAI API** | GPT models for form filling |
| **Google Gemini API** | Alternative AI provider |

## Security & Privacy

Smart Fill is designed with privacy as a priority:

- **Local Storage Only** - API keys and user data are stored in Chrome's local storage
- **No External Servers** - Data is only sent to your chosen AI provider (OpenAI or Google)
- **No Tracking** - No analytics or user tracking
- **Open Source** - Full code transparency

## FAQ

### What forms can Smart Fill handle?

Smart Fill works with most web forms including login forms, registration forms, contact forms, checkout forms, and application forms.

### Is my data safe?

Yes. All your personal data and API keys are stored locally in your browser. Data is only sent to OpenAI or Google when you click "Auto Fill with AI".

### Which AI model should I choose?

- **GPT-4o Mini** - Best balance of speed and accuracy (recommended)
- **GPT-4o** - Highest accuracy for complex forms
- **Gemini 1.5 Flash** - Fastest responses, most cost-effective

### Do I need an API key?

Yes. You need an API key from either [OpenAI](https://platform.openai.com/api-keys) or [Google AI Studio](https://aistudio.google.com/app/apikey).

## License

This project is licensed under the [MIT License](LICENSE).

---

**Keywords**: Chrome extension, AI form filler, auto-fill forms, OpenAI GPT, Google Gemini, form automation, browser extension, Vue.js, web forms, automatic form completion
