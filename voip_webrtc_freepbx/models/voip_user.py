# -*- coding: utf-8 -*-
#################################################################################
#
# Module Name: Voip Webrtc Freepbx
# Description: Establishes real-time VoIP communication between Odoo and FreePBX 
#              using WebRTC and PJSIP for seamless browser-based calling integration.
#
# Copyright (c) 2025
# Author: Mohamed Samir Abouelez Abdou
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
#     Mohamed Samir Abouelez Abdou
#     Email: kenzey0man@gmail.com
#
# ---------------------------------------------------------------------------
# © 2025 — All Rights Reserved — Mohamed Samir Abouelez Abdou
#################################################################################
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)


class VoipUser(models.Model):
    _name = 'voip.user'
    _description = 'VoIP User Configuration'
    _inherit = ['mail.thread', 'mail.activity.mixin']

    name = fields.Char(
        string='Name',
        compute='_compute_name',
        store=True
    )
    
    user_id = fields.Many2one(
        'res.users',
        string='Odoo User',
        required=True,
        ondelete='cascade',
        tracking=True
    )
    
    server_id = fields.Many2one(
        'voip.server',
        string='VoIP Server',
        required=True,
        ondelete='cascade',
        tracking=True
    )
    
    sip_username = fields.Char(
        string='SIP Username',
        required=True,
        tracking=True,
        help='SIP extension number or username'
    )
    
    sip_password = fields.Char(
        string='SIP Password',
        required=True,
        help='SIP password for authentication'
    )
    
    display_name = fields.Char(
        string='Display Name',
        help='Display name for outgoing calls'
    )
    
    active = fields.Boolean(
        string='Active',
        default=True,
        tracking=True
    )
    
    auto_answer = fields.Boolean(
        string='Auto Answer',
        default=False,
        help='Automatically answer incoming calls'
    )
    
    call_ids = fields.One2many(
        'voip.call',
        'user_id',
        string='Calls'
    )
    
    incoming_calls_count = fields.Integer(
        string='Incoming Calls',
        compute='_compute_call_stats'
    )
    
    outgoing_calls_count = fields.Integer(
        string='Outgoing Calls',
        compute='_compute_call_stats'
    )
    
    total_call_duration = fields.Float(
        string='Total Call Duration (hours)',
        compute='_compute_call_stats',
        help='Total duration of all calls in hours'
    )
    
    ring_tone = fields.Selection([
        ('default', 'Default'),
        ('classic', 'Classic'),
        ('modern', 'Modern'),
        ('silent', 'Silent'),
    ], string='Ring Tone', default='default')
    
    enable_recording = fields.Boolean(
        string='Enable Recording',
        default=True,
        help='Enable call recording for this user'
    )
    
    auto_start_recording = fields.Boolean(
        string='Auto Start Recording',
        default=True,
        help='Automatically start recording when call begins'
    )
    
    can_control_recording = fields.Boolean(
        string='Can Control Recording',
        default=False,
        help='Allow user to manually start/stop recording during calls'
    )
    
    recording_quality = fields.Selection([
        ('low', 'Low (64kbps)'),
        ('medium', 'Medium (128kbps)'),
        ('high', 'High (256kbps)'),
    ], string='Recording Quality', default='medium')
    
    recording_format = fields.Selection([
        ('webm', 'WebM (Recommended)'),
        ('mp4', 'MP4'),
        ('wav', 'WAV'),
    ], string='Recording Format', default='webm')
    
    last_login = fields.Datetime(
        string='Last Login',
        readonly=True
    )
    
    notes = fields.Text(
        string='Notes'
    )

    _sql_constraints = [
        ('unique_user_server', 'unique(user_id, server_id)', 
         'A user can only have one VoIP configuration per server!')
    ]

    @api.depends('user_id', 'sip_username')
    def _compute_name(self):
        for record in self:
            if record.user_id and record.sip_username:
                record.name = f"{record.user_id.name} ({record.sip_username})"
            elif record.user_id:
                record.name = record.user_id.name
            else:
                record.name = record.sip_username or 'New VoIP User'

    @api.depends('call_ids', 'call_ids.direction', 'call_ids.duration')
    def _compute_call_stats(self):
        for record in self:
            incoming_calls = record.call_ids.filtered(lambda c: c.direction == 'inbound')
            outgoing_calls = record.call_ids.filtered(lambda c: c.direction == 'outbound')
            
            record.incoming_calls_count = len(incoming_calls)
            record.outgoing_calls_count = len(outgoing_calls)
            record.total_call_duration = sum(record.call_ids.mapped('duration')) / 3600.0

    def action_view_calls(self):
        self.ensure_one()
        return {
            'name': _('Call History'),
            'type': 'ir.actions.act_window',
            'res_model': 'voip.call',
            'view_mode': 'tree,form',
            'domain': [('user_id', '=', self.id)],
            'context': {'default_user_id': self.id}
        }

    def get_voip_config(self):
        self.ensure_one()
        return {
            'server': {
                'host': self.server_id.host,
                'websocket_url': self.server_id.websocket_url,
                'port': self.server_id.port,
                'realm': self.server_id.realm or self.server_id.host,
                'use_tls': self.server_id.use_tls,
                'stun_server': self.server_id.stun_server,
                'turn_server': self.server_id.turn_server,
                'turn_username': self.server_id.turn_username,
                'turn_password': self.server_id.turn_password,
            },
            'user': {
                'username': self.sip_username,
                'password': self.sip_password,
                'display_name': self.display_name or self.user_id.name,
                'auto_answer': self.auto_answer,
                'ring_tone': self.ring_tone,
                'enable_recording': self.enable_recording,
                'auto_start_recording': self.auto_start_recording,
                'can_control_recording': self.can_control_recording,
                'recording_quality': self.recording_quality,
                'recording_format': self.recording_format,
            }
        }

    def update_last_login(self):
        self.ensure_one()
        self.last_login = fields.Datetime.now()
