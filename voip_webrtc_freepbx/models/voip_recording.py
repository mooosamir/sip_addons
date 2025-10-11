from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
import base64
import logging

_logger = logging.getLogger(__name__)


class VoipRecording(models.Model):
    _name = 'voip.recording'
    _description = 'VoIP Call Recording'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    name = fields.Char(
        string='Recording Name',
        required=True,
        tracking=True
    )
    
    call_id = fields.Many2one(
        'voip.call',
        string='Call',
        required=True,
        ondelete='cascade',
        tracking=True
    )
    
    user_id = fields.Many2one(
        'res.users',
        string='User',
        related='call_id.odoo_user_id',
        store=True,
        readonly=True
    )
    
    recording_file = fields.Binary(
        string='Recording File',
        attachment=True,
        help='Audio file of the call recording'
    )
    
    recording_filename = fields.Char(
        string='Filename'
    )
    
    file_size = fields.Integer(
        string='File Size',
        help='File size in bytes'
    )
    
    file_size_display = fields.Char(
        string='Size',
        compute='_compute_file_size_display'
    )
    
    duration = fields.Float(
        string='Duration (seconds)',
        help='Recording duration in seconds'
    )
    
    duration_display = fields.Char(
        string='Duration',
        compute='_compute_duration_display'
    )
    
    recording_type = fields.Selection([
        ('automatic', 'Automatic'),
        ('manual', 'Manual'),
    ], string='Recording Type', default='automatic', required=True)
    
    state = fields.Selection([
        ('recording', 'Recording'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ], string='Status', default='recording', required=True, tracking=True)
    
    recording_url = fields.Char(
        string='Recording URL',
        help='URL to access the recording from FreePBX server'
    )
    
    shared_with_ids = fields.Many2many(
        'res.users',
        'voip_recording_share_rel',
        'recording_id',
        'user_id',
        string='Shared With',
        tracking=True,
        help='Users who have access to this recording'
    )
    
    notes = fields.Text(
        string='Notes'
    )
    
    format = fields.Selection([
        ('wav', 'WAV'),
        ('mp3', 'MP3'),
        ('ogg', 'OGG'),
    ], string='Format', default='wav')

    @api.depends('file_size')
    def _compute_file_size_display(self):
        for record in self:
            if record.file_size:
                size = record.file_size
                for unit in ['B', 'KB', 'MB', 'GB']:
                    if size < 1024.0:
                        record.file_size_display = f"{size:.2f} {unit}"
                        break
                    size /= 1024.0
            else:
                record.file_size_display = '0 B'

    @api.depends('duration')
    def _compute_duration_display(self):
        for record in self:
            if record.duration:
                hours = int(record.duration // 3600)
                minutes = int((record.duration % 3600) // 60)
                seconds = int(record.duration % 60)
                
                if hours > 0:
                    record.duration_display = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                else:
                    record.duration_display = f"{minutes:02d}:{seconds:02d}"
            else:
                record.duration_display = "00:00"

    def action_share_recording(self):
        self.ensure_one()
        return {
            'name': _('Share Recording'),
            'type': 'ir.actions.act_window',
            'res_model': 'voip.recording.share.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_recording_id': self.id}
        }

    def action_download_recording(self):
        self.ensure_one()
        if not self.recording_file:
            raise UserError(_('No recording file available for download.'))
        
        return {
            'type': 'ir.actions.act_url',
            'url': f'/web/content/voip.recording/{self.id}/recording_file/{self.recording_filename}?download=true',
            'target': 'self',
        }

    def action_play_recording(self):
        self.ensure_one()
        if not self.recording_file:
            raise UserError(_('No recording file available to play.'))
        
        return {
            'type': 'ir.actions.act_url',
            'url': f'/web/content/voip.recording/{self.id}/recording_file/{self.recording_filename}',
            'target': 'new',
        }

    def share_with_users(self, user_ids):
        self.ensure_one()
        self.shared_with_ids = [(4, user_id) for user_id in user_ids]
        
        # Send notification to shared users
        for user in self.env['res.users'].browse(user_ids):
            self.message_post(
                body=_('Recording shared with %s', user.name),
                partner_ids=user.partner_id.ids,
                subtype_xmlid='mail.mt_note'
            )

    def unshare_from_user(self, user_id):
        self.ensure_one()
        self.shared_with_ids = [(3, user_id)]
        
        user = self.env['res.users'].browse(user_id)
        self.message_post(
            body=_('Recording unshared from %s', user.name),
            subtype_xmlid='mail.mt_note'
        )
