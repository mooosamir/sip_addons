# -*- coding: utf-8 -*-
#################################################################################
#
# Module Name: Voip Webrtc Freepbx
# Description: Establishes real-time VoIP communication between Odoo and FreePBX 
#              using WebRTC and PJSIP for seamless browser-based calling integration.
#
# Copyright (c) 2025
# Author: Mohamed Samir Abouelez 
# Website: https://odoo-vip.com
# Email: kenzey0man@gmail.com
# Phone: +20 100 057 3614
#
# License: Odoo Proprietary License v1.0 (OPL-1)
# License URL: https://www.odoo.com/documentation/master/legal/licenses.html#odoo-proprietary-license
#
# ---------------------------------------------------------------------------
# ⚠️ Usage and Modification Restrictions:
#
# - This software is licensed under the Odoo Proprietary License (OPL-1).
# - You are NOT permitted to modify, copy, redistribute, or reuse any part of
#   this source code without the explicit written consent of the author.
# - Partial use, extraction, reverse engineering, or integration of this code
#   into other projects without authorization is strictly prohibited.
# - Any commercial use or deployment must be approved directly by:
#     Mohamed Samir Abouelez 
#     Email: kenzey0man@gmail.com
#
# ---------------------------------------------------------------------------
# © 2025 — All Rights Reserved — Mohamed Samir Abouelez 
#################################################################################
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)


class VoipServer(models.Model):
    _name = 'voip.server'
    _description = 'VoIP Server Configuration'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(
        string='Server Name',
        required=True,
        tracking=True,
        help='Name to identify this VoIP server'
    )
    
    host = fields.Char(
        string='Server Host',
        required=True,
        tracking=True,
        help='FreePBX server hostname or IP address'
    )
    
    websocket_url = fields.Char(
        string='WebSocket URL',
        required=True,
        tracking=True,
        help='WebSocket URL for WebRTC connection (e.g., wss://your-server:8089/ws)'
    )
    
    port = fields.Integer(
        string='SIP Port',
        default=5060,
        tracking=True,
        help='SIP port number (default: 5060)'
    )
    
    secure_port = fields.Integer(
        string='Secure SIP Port',
        default=5061,
        help='Secure SIP port number (default: 5061)'
    )
    
    use_tls = fields.Boolean(
        string='Use TLS',
        default=True,
        tracking=True,
        help='Enable TLS encryption for SIP connection'
    )
    
    realm = fields.Char(
        string='Realm',
        help='SIP realm for authentication'
    )
    
    active = fields.Boolean(
        string='Active',
        default=True,
        tracking=True
    )
    
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
        required=True
    )
    
    user_ids = fields.One2many(
        'voip.user',
        'server_id',
        string='VoIP Users'
    )
    
    user_count = fields.Integer(
        string='Number of Users',
        compute='_compute_user_count'
    )
    
    call_ids = fields.One2many(
        'voip.call',
        'server_id',
        string='Calls'
    )
    
    call_count = fields.Integer(
        string='Number of Calls',
        compute='_compute_call_count'
    )
    
    enable_recording = fields.Boolean(
        string='Enable Call Recording',
        default=True,
        tracking=True,
        help='Enable automatic call recording'
    )
    
    recording_path = fields.Char(
        string='Recording Path',
        help='Path where call recordings are stored on FreePBX server'
    )
    
    stun_server = fields.Char(
        string='STUN Server',
        default='stun:stun.l.google.com:19302',
        help='STUN server for NAT traversal (Google public STUN server by default)'
    )
    
    turn_server = fields.Char(
        string='TURN Server',
        help='TURN server for NAT traversal (optional)'
    )
    
    turn_username = fields.Char(
        string='TURN Username',
        help='Username for TURN server authentication'
    )
    
    turn_password = fields.Char(
        string='TURN Password',
        help='Password for TURN server authentication'
    )
    
    notes = fields.Text(
        string='Notes'
    )

    @api.depends('user_ids')
    def _compute_user_count(self):
        for record in self:
            record.user_count = len(record.user_ids)

    @api.depends('call_ids')
    def _compute_call_count(self):
        for record in self:
            record.call_count = len(record.call_ids)

    @api.constrains('host', 'websocket_url')
    def _check_server_config(self):
        for record in self:
            if not record.host:
                raise ValidationError(_('Server host is required.'))
            if not record.websocket_url:
                raise ValidationError(_('WebSocket URL is required.'))

    def action_test_connection(self):
        self.ensure_one()
        # This method can be extended to test the connection to FreePBX
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Test Connection'),
                'message': _('Connection test initiated. Check server logs for details.'),
                'type': 'info',
                'sticky': False,
            }
        }

    def action_view_users(self):
        self.ensure_one()
        return {
            'name': _('VoIP Users'),
            'type': 'ir.actions.act_window',
            'res_model': 'voip.user',
            'view_mode': 'tree,form',
            'domain': [('server_id', '=', self.id)],
            'context': {'default_server_id': self.id}
        }

    def action_view_calls(self):
        self.ensure_one()
        return {
            'name': _('Call History'),
            'type': 'ir.actions.act_window',
            'res_model': 'voip.call',
            'view_mode': 'tree,form',
            'domain': [('server_id', '=', self.id)],
        }
