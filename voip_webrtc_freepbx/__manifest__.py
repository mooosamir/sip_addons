{
    'name': 'VoIP WebRTC FreePBX',
    'version': '17.0.1.0.0',
    'category': 'Productivity/VoIP',
    'summary': 'VoIP and WebRTC integration with FreePBX server for call management',
    'description': """
        VoIP WebRTC FreePBX Integration
        ================================
        
        This module provides full VoIP functionality with WebRTC integration:
        
        * Connect to FreePBX server via SIP/WebRTC
        * Make and receive calls directly from Odoo
        * Call recording and playback
        * Call history and analytics
        * Share call recordings with other users
        * Multi-language support (Arabic and English)
        * Clean architecture and code
        
        Technical Features:
        -------------------
        * WebRTC-based calling using open source libraries
        * SIP.js integration for SIP protocol
        * Real-time call status updates
        * Audio recording and storage
        * Call logs and reporting
    """,
    'author': 'Mohamed Samir',
    'maintainer': 'odoo-vip.com',
    'website': 'https://odoo-vip.com',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'web',
        'mail',
        'contacts',
    ],
    'data': [
        'security/voip_security.xml',
        'security/ir.model.access.csv',
        'views/voip_server_views.xml',
        'views/voip_user_views.xml',
        'views/voip_call_views.xml',
        'views/voip_recording_views.xml',
        'views/voip_menus.xml',
        'data/voip_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'voip_webrtc_freepbx/static/src/js/voip_client.js',
            'voip_webrtc_freepbx/static/src/js/voip_service.js',
            'voip_webrtc_freepbx/static/src/js/voip_systray.js',
            'voip_webrtc_freepbx/static/src/xml/voip_templates.xml',
            'voip_webrtc_freepbx/static/src/css/voip_style.css',
            'voip_webrtc_freepbx/static/lib/sip.js',
        ],
    },
    'external_dependencies': {
        'python': [],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
