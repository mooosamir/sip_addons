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
from odoo import http, fields
from odoo.http import request, Response
import json
import logging
import base64
import time
from ..utils.logging_utils import VoipLoggingUtils

_logger = logging.getLogger(__name__)


class VoipController(http.Controller):

    @http.route('/voip/config', type='json', auth='user')
    def get_voip_config(self, **kwargs):
        """Get VoIP configuration for current user"""
        try:
            VoipLoggingUtils.log_if_enabled(
                request.env, _logger, 'info', 
                'Getting VoIP config for user %s', request.env.user.name
            )
            user = request.env.user
            voip_user = request.env['voip.user'].search([
                ('user_id', '=', user.id),
                ('active', '=', True)
            ], limit=1)
            
            if not voip_user:
                return {
                    'success': False,
                    'error': 'No VoIP configuration found for current user'
                }
            
            # Update last login
            voip_user.update_last_login()
            
            config = voip_user.get_voip_config()
            
            # Add logging configuration
            logging_config = VoipLoggingUtils.get_js_logging_config(request.env, voip_user.server_id.id)
            config['logging'] = logging_config
            
            return {
                'success': True,
                'config': config
            }
        except Exception as e:
            VoipLoggingUtils.log_if_enabled(
                request.env, _logger, 'error', 
                "Error getting VoIP config: %s", str(e)
            )
            return {
                'success': False,
                'error': str(e)
            }

    @http.route('/voip/call/create', type='json', auth='user')
    def create_call(self, **kwargs):
        """Create a new call record"""
        try:
            user = request.env.user
            voip_user = request.env['voip.user'].search([
                ('user_id', '=', user.id),
                ('active', '=', True)
            ], limit=1)
            
            if not voip_user:
                return {'success': False, 'error': 'No VoIP user found'}
            
            call_data = {
                'user_id': voip_user.id,
                'direction': kwargs.get('direction', 'outbound'),
                'from_number': kwargs.get('from_number'),
                'to_number': kwargs.get('to_number'),
                'call_id': kwargs.get('call_id'),
                'state': 'ringing',
            }
            
            call = request.env['voip.call'].create(call_data)
            
            return {
                'success': True,
                'call_id': call.id,
                'call_name': call.name
            }
        except Exception as e:
            VoipLoggingUtils.log_if_enabled(
                request.env, _logger, 'error', 
                "Error creating call: %s", str(e)
            )
            return {'success': False, 'error': str(e)}

    @http.route('/voip/call/update', type='json', auth='user')
    def update_call(self, call_id, state, **kwargs):
        """Update call state"""
        try:
            call = request.env['voip.call'].browse(call_id)
            
            if not call.exists():
                return {'success': False, 'error': 'Call not found'}
            
            update_vals = {'state': state}
            
            if state == 'in_progress' and not call.answer_time:
                update_vals['answer_time'] = kwargs.get('answer_time') or http.request.env.cr.now()
            
            if state in ['completed', 'missed', 'failed', 'rejected', 'busy']:
                update_vals['end_time'] = kwargs.get('end_time') or http.request.env.cr.now()
                update_vals['hangup_reason'] = kwargs.get('hangup_reason', 'normal')
            
            call.write(update_vals)
            
            return {
                'success': True,
                'call_id': call.id,
                'duration': call.duration
            }
        except Exception as e:
            _logger.exception("Error updating call: %s", str(e))
            return {'success': False, 'error': str(e)}

    @http.route('/voip/call/list', type='json', auth='user')
    def list_calls(self, limit=50, offset=0, **kwargs):
        """Get list of calls for current user"""
        try:
            user = request.env.user
            domain = [('odoo_user_id', '=', user.id)]
            
            if kwargs.get('state'):
                domain.append(('state', '=', kwargs.get('state')))
            
            if kwargs.get('direction'):
                domain.append(('direction', '=', kwargs.get('direction')))
            
            calls = request.env['voip.call'].search(
                domain,
                limit=limit,
                offset=offset,
                order='start_time desc'
            )
            
            call_list = []
            for call in calls:
                call_list.append({
                    'id': call.id,
                    'name': call.name,
                    'direction': call.direction,
                    'state': call.state,
                    'from_number': call.from_number,
                    'to_number': call.to_number,
                    'partner_name': call.partner_id.name if call.partner_id else False,
                    'start_time': call.start_time.isoformat() if call.start_time else False,
                    'duration': call.duration,
                    'duration_display': call.duration_display,
                    'has_recording': call.has_recording,
                })
            
            return {
                'success': True,
                'calls': call_list,
                'total': len(call_list)
            }
        except Exception as e:
            _logger.exception("Error listing calls: %s", str(e))
            return {'success': False, 'error': str(e)}

    @http.route('/voip/recording/create', type='json', auth='user')
    def create_recording(self, call_id, **kwargs):
        """Create a recording record"""
        try:
            call = request.env['voip.call'].browse(call_id)
            
            if not call.exists():
                return {'success': False, 'error': 'Call not found'}
            
            recording_data = {
                'name': kwargs.get('name', f"Recording - {call.name}"),
                'call_id': call_id,
                'recording_type': kwargs.get('recording_type', 'automatic'),
                'state': kwargs.get('state', 'recording'),
                'format': kwargs.get('format', 'wav'),
            }
            
            recording = request.env['voip.recording'].create(recording_data)
            
            return {
                'success': True,
                'recording_id': recording.id
            }
        except Exception as e:
            _logger.exception("Error creating recording: %s", str(e))
            return {'success': False, 'error': str(e)}

    @http.route('/voip/recording/upload', type='http', auth='user', methods=['POST'], csrf=False)
    def upload_recording(self, recording_id, **kwargs):
        """Upload recording file"""
        try:
            recording = request.env['voip.recording'].browse(int(recording_id))
            
            if not recording.exists():
                return Response(
                    json.dumps({'success': False, 'error': 'Recording not found'}),
                    content_type='application/json',
                    status=404
                )
            
            file_data = request.httprequest.files.get('file')
            if not file_data:
                return Response(
                    json.dumps({'success': False, 'error': 'No file provided'}),
                    content_type='application/json',
                    status=400
                )
            
            import base64
            file_content = base64.b64encode(file_data.read())
            
            recording.write({
                'recording_file': file_content,
                'recording_filename': file_data.filename,
                'file_size': len(file_content),
                'state': 'completed',
            })
            
            return Response(
                json.dumps({'success': True, 'recording_id': recording.id}),
                content_type='application/json'
            )
        except Exception as e:
            _logger.exception("Error uploading recording: %s", str(e))
            return Response(
                json.dumps({'success': False, 'error': str(e)}),
                content_type='application/json',
                status=500
            )

    @http.route('/voip/search/partner', type='json', auth='user')
    def search_partner(self, phone, **kwargs):
        """Search for partner by phone number"""
        try:
            if not phone:
                return {'success': False, 'error': 'Phone number required'}
            
            # Clean phone number
            clean_phone = phone.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
            
            # Search for partner
            partner = request.env['res.partner'].search([
                '|', '|',
                ('phone', 'ilike', clean_phone),
                ('mobile', 'ilike', clean_phone),
                ('phone', 'ilike', phone)
            ], limit=1)
            
            if partner:
                return {
                    'success': True,
                    'partner': {
                        'id': partner.id,
                        'name': partner.name,
                        'phone': partner.phone,
                        'mobile': partner.mobile,
                        'email': partner.email,
                    }
                }
            else:
                return {
                    'success': True,
                    'partner': None
                }
        except Exception as e:
            _logger.exception("Error searching partner: %s", str(e))
            return {'success': False, 'error': str(e)}

    @http.route('/voip/contacts/list', type='json', auth='user')
    def get_contacts_list(self, limit=100, **kwargs):
        """Get contacts list with phone numbers"""
        try:
            partners = request.env['res.partner'].search([
                '|', ('phone', '!=', False), ('mobile', '!=', False)
            ], limit=limit, order='name')
            
            contacts = []
            for partner in partners:
                phone = partner.phone or partner.mobile
                if phone:
                    contacts.append({
                        'id': partner.id,
                        'name': partner.name,
                        'phone': phone,
                        'mobile': partner.mobile,
                        'email': partner.email,
                        'company': partner.parent_id.name if partner.parent_id else None,
                    })
            
            return {
                'success': True,
                'contacts': contacts
            }
        except Exception as e:
            _logger.exception("Error getting contacts list: %s", str(e))
            return {'success': False, 'error': str(e)}

    @http.route('/voip_webrtc_freepbx/save_recording', type='http', auth='user', methods=['POST'], csrf=False)
    def save_recording(self):
        """Save call recording to server"""
        try:
            _logger.info('🔧 VoIP Controller Debug: ===== SAVE RECORDING START =====')
            _logger.info('🔧 VoIP Controller Debug: User: %s', request.env.user.name)
            _logger.info('🔧 VoIP Controller Debug: User ID: %s', request.env.user.id)
            _logger.info('🔧 VoIP Controller Debug: Request method: %s', request.httprequest.method)
            _logger.info('🔧 VoIP Controller Debug: Content type: %s', request.httprequest.content_type)
            _logger.info('🔧 VoIP Controller Debug: Content length: %s', request.httprequest.content_length)
            
            # Get uploaded file
            recording_file = request.httprequest.files.get('recording')
            call_id_str = request.httprequest.form.get('call_id', '0')
            duration = int(request.httprequest.form.get('duration', 0))
            
            # Convert call_id to integer
            try:
                call_id = int(call_id_str)
            except (ValueError, TypeError):
                _logger.error('🔧 VoIP Controller Debug: Invalid call_id: %s', call_id_str)
                return json.dumps({'error': 'Invalid call_id'})
            
            _logger.info('🔧 VoIP Controller Debug: Call ID: %s (type: %s)', call_id, type(call_id).__name__)
            _logger.info('🔧 VoIP Controller Debug: Duration from request: %s seconds', duration)
            _logger.info('🔧 VoIP Controller Debug: Recording file: %s', recording_file)
            
            if not recording_file:
                _logger.error('🔧 VoIP Controller Debug: No recording file provided')
                return json.dumps({'error': 'No recording file provided'})
            
            _logger.info('🔧 VoIP Controller Debug: Recording file name: %s', recording_file.filename)
            _logger.info('🔧 VoIP Controller Debug: Recording file size: %s bytes', len(recording_file.read()))
            recording_file.seek(0)  # Reset file pointer
            
            # Verify call exists
            call = request.env['voip.call'].browse(call_id)
            if not call.exists():
                _logger.error('🔧 VoIP Controller Debug: Call with ID %s not found', call_id)
                return json.dumps({'error': f'Call {call_id} not found'})
            
            # Use duration from JavaScript (calculated from actual call time)
            # Don't use call.duration because end_time might not be updated yet
            _logger.info('🔧 VoIP Controller Debug: Using duration from JavaScript: %s seconds', duration)
            _logger.info('🔧 VoIP Controller Debug: Call duration (for reference): %s seconds', call.duration if call.duration else 0)
            
            # Create voip.recording record
            recording_data = {
                'name': f'Call Recording - {call_id}',
                'call_id': call_id,
                'duration': duration,
                'state': 'completed',  # Mark as completed since we have the file
                # user_id will be auto-populated from call_id.odoo_user_id (related field)
                # caller/callee will be auto-populated by create() method
            }
            
            _logger.info('🔧 VoIP Controller Debug: Recording data: %s', recording_data)
            
            # Read file data
            file_data = recording_file.read()
            _logger.info('🔧 VoIP Controller Debug: File data size: %s bytes', len(file_data))
            
            # Encode to base64
            attachment_data = base64.b64encode(file_data)
            _logger.info('🔧 VoIP Controller Debug: Base64 data size: %s bytes', len(attachment_data))
            
            # Add recording file and filename to recording data
            recording_data['recording_file'] = attachment_data
            recording_data['recording_filename'] = f'call_recording_{call_id}_{int(time.time())}.webm'
            recording_data['file_size'] = len(file_data)
            
            _logger.info('🔧 VoIP Controller Debug: Updated recording data with file')
            
            # Create recording record (attachment will be auto-created because attachment=True)
            recording = request.env['voip.recording'].create(recording_data)
            _logger.info('🔧 VoIP Controller Debug: Recording record created with ID: %s', recording.id)
            
            _logger.info('🔧 VoIP Controller Debug: Recording saved successfully')
            _logger.info('🔧 VoIP Controller Debug: Final recording ID: %s', recording.id)
            _logger.info('🔧 VoIP Controller Debug: File size: %s bytes', recording.file_size)
            _logger.info('🔧 VoIP Controller Debug: ===== SAVE RECORDING END =====')
            
            return json.dumps({
                'success': True,
                'recording_id': recording.id,
                'file_size': recording.file_size,
                'message': 'Recording saved successfully'
            })
            
        except Exception as e:
            _logger.error('🔧 VoIP Controller Debug: ===== SAVE RECORDING ERROR =====')
            _logger.error('🔧 VoIP Controller Debug: Error type: %s', type(e).__name__)
            _logger.error('🔧 VoIP Controller Debug: Error message: %s', str(e))
            _logger.error('🔧 VoIP Controller Debug: Error details: %s', repr(e))
            _logger.error('🔧 VoIP Controller Debug: ===== END ERROR =====')
            return json.dumps({'error': str(e)})
