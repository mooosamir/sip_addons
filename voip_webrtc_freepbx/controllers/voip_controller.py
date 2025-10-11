from odoo import http
from odoo.http import request, Response
import json
import logging

_logger = logging.getLogger(__name__)


class VoipController(http.Controller):

    @http.route('/voip/config', type='json', auth='user')
    def get_voip_config(self, **kwargs):
        """Get VoIP configuration for current user"""
        try:
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
            return {
                'success': True,
                'config': config
            }
        except Exception as e:
            _logger.exception("Error getting VoIP config: %s", str(e))
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
            _logger.exception("Error creating call: %s", str(e))
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
