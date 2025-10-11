# VoIP WebRTC FreePBX Integration for Odoo 17

A comprehensive VoIP and WebRTC integration module for Odoo 17 Community Edition that connects seamlessly with FreePBX servers.

## Features

- **WebRTC Browser Calling**: Make and receive calls directly from your browser without any plugins
- **FreePBX Integration**: Direct SIP connection to your FreePBX server via WebSocket
- **Call Recording**: Automatic call recording with playback and download capabilities
- **Call History & Analytics**: Detailed call logs with duration tracking and reporting
- **Contact Integration**: Automatic matching of calls to contacts in your system
- **Recording Management**: Share call recordings with other users
- **Multi-language Support**: Full support for Arabic and English
- **Clean Architecture**: Built following clean code principles and best practices
- **Systray Widget**: Quick access to dialer and recent calls from the systray

## Technical Stack

- **WebRTC Library**: SIP.js (Google open source)
- **Protocol**: SIP over WebSocket (WSS)
- **NAT Traversal**: STUN/TURN support (Google's public STUN server configured by default)
- **Audio Codec**: Opus (WebM format)
- **Security**: TLS/WSS encryption support

## Installation

### 1. Install the Module

```bash
# Copy the module to your Odoo addons directory
cp -r voip_webrtc_freepbx /path/to/odoo/addons/

# Update apps list and install
# Go to Odoo Apps → Update Apps List → Search for "VoIP WebRTC FreePBX" → Install
```

### 2. Install SIP.js Library

Download the SIP.js library and place it in the static/lib directory:

```bash
# Download SIP.js from GitHub
wget https://cdn.jsdelivr.net/npm/sip.js@0.20.0/dist/sip.min.js -O voip_webrtc_freepbx/static/lib/sip.js

# Or download from: https://github.com/onsip/SIP.js/releases
```

### 3. Configure FreePBX Server

Ensure your FreePBX server has WebRTC support enabled:

1. Install the WebRTC module in FreePBX
2. Configure WebSocket settings
3. Set up SSL certificates for secure connection
4. Create SIP extensions for your users

## Configuration

### VoIP Server Setup

1. Navigate to **VoIP → Configuration → VoIP Servers**
2. Click **Create** and fill in the following:
   - **Server Name**: Friendly name (e.g., "Main PBX")
   - **Server Host**: Your FreePBX hostname or IP address
   - **WebSocket URL**: WebSocket URL (e.g., `wss://pbx.example.com:8089/ws`)
   - **SIP Port**: Default is 5060
   - **Use TLS**: Enable for secure connections
   - **STUN Server**: Google's public STUN server is pre-configured
   - **Enable Recording**: Check to enable call recording

3. Click **Test Connection** to verify the configuration

### VoIP User Configuration

1. Navigate to **VoIP → Configuration → VoIP Users**
2. Click **Create** and configure:
   - **Odoo User**: Select the Odoo user
   - **VoIP Server**: Select the configured server
   - **SIP Username**: Extension number from FreePBX (e.g., "1001")
   - **SIP Password**: SIP secret/password from FreePBX
   - **Display Name**: Name to show on outgoing calls
   - **Enable Recording**: Check to enable call recording for this user

3. Save the configuration

## Usage

### Making Calls

1. Click the **phone icon** in the systray (top-right corner)
2. The VoIP dialer will open
3. Enter a phone number using the dialpad or keyboard
4. Click **Call** to initiate the call
5. Click **Hang Up** to end the call

### Receiving Calls

Incoming calls will automatically display a notification. You can:
- Accept the call
- Reject the call
- The call will be logged automatically

### Viewing Call History

1. Navigate to **VoIP → Calls → Call History**
2. View all your calls with details:
   - Direction (Inbound/Outbound)
   - Contact information
   - Duration
   - Status
   - Recording availability

### Managing Call Recordings

1. Navigate to **VoIP → Calls → Recordings**
2. View, play, or download recordings
3. Share recordings with other users:
   - Open a recording
   - Click **Share**
   - Select users to share with

## Security & Permissions

The module includes two security groups:

- **VoIP User**: Can make calls, view their own call history, and access shared recordings
- **VoIP Manager**: Full access to all VoIP features, server configuration, and all users' data

## FreePBX Server Requirements

- FreePBX 15 or higher
- WebRTC Phone module installed and configured
- Valid SSL certificate for WSS connections
- WebSocket listening on configured port (default: 8089)
- Firewall rules allowing WebSocket connections

## Troubleshooting

### Cannot Connect to Server

- Check WebSocket URL is correct
- Verify SSL certificate is valid
- Check firewall rules
- Test connection from FreePBX admin panel

### No Audio in Calls

- Check browser permissions for microphone
- Verify STUN/TURN server configuration
- Check network NAT/firewall settings

### Recording Not Working

- Ensure "Enable Recording" is checked in server and user config
- Verify browser supports MediaRecorder API
- Check storage permissions

## Development

The module follows clean code and clean architecture principles:

```
voip_webrtc_freepbx/
├── models/           # Business logic and data models
├── views/            # UI views and forms
├── controllers/      # HTTP controllers and API endpoints
├── security/         # Access control and permissions
├── static/           # Frontend assets
│   ├── src/
│   │   ├── js/      # JavaScript files
│   │   ├── css/     # Stylesheets
│   │   └── xml/     # QWeb templates
│   └── lib/         # External libraries
├── i18n/            # Translations
└── data/            # Demo and initial data
```

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Follow Odoo coding standards
2. Write clean, documented code
3. Test thoroughly before submitting
4. Add translations for new strings

## License

This module is licensed under LGPL-3.

## Credits

- **Author**: Mohamed Samir
- **Maintainer**: odoo-vip.com
- **Website**: https://odoo-vip.com
- **Version**: 17.0.1.0.0

## Support

For support and questions:
- Website: https://odoo-vip.com
- Email: support@odoo-vip.com

## Acknowledgments

- SIP.js library by OnSIP
- Google WebRTC project
- Odoo community

---

© 2025 odoo-vip.com. All rights reserved.
