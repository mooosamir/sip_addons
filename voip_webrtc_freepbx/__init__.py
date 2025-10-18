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

from . import models
from . import controllers


def pre_init_check(cr):
    """
    Check before installing the module:
    1. Ensure Odoo version is 17.0
    2. Ensure required Python packages are installed
    """
    from odoo.service import common
    version_info = common.exp_version()
    server_serie = version_info.get('server_serie')

    # ✅ Check Odoo version
    if server_serie != '17.0':
        raise UserError(f"Module supports Odoo series 17.0 only — found {server_serie}.")
