/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { VoipClient } from "./voip_client";

/**
 * VoIP Systray Item
 * 
 * Provides quick access to VoIP functionality from the systray
 */
export class VoipSystray extends Component {
    setup() {
        this.voip = useService("voip");
        this.notification = useService("notification");
        this.action = useService("action");
        
        this.state = useState({
            isInitialized: false,
            isRegistered: false,
            showDialer: false,
            phoneNumber: "",
            inCall: false,
            callDuration: 0,
            recentCalls: [],
        });

        onWillStart(async () => {
            await this.initializeVoip();
        });

        onMounted(() => {
            this.updateCallDuration();
        });
    }

    /**
     * Initialize VoIP client
     */
    async initializeVoip() {
        try {
            const initialized = await this.voip.initialize();
            if (initialized) {
                const config = this.voip.getConfig();
                const voipClient = new VoipClient(config, this.voip);
                await voipClient.initialize();
                
                this.voip.setVoipClient(voipClient);
                this.state.isInitialized = true;
                this.state.isRegistered = voipClient.isClientRegistered();
                
                // Load recent calls
                await this.loadRecentCalls();
            }
        } catch (error) {
            console.error('Failed to initialize VoIP:', error);
        }
    }

    /**
     * Load recent calls
     */
    async loadRecentCalls() {
        const calls = await this.voip.getCallHistory(5);
        this.state.recentCalls = calls;
    }

    /**
     * Toggle dialer visibility
     */
    toggleDialer() {
        this.state.showDialer = !this.state.showDialer;
    }

    /**
     * Update phone number input
     */
    onPhoneNumberInput(ev) {
        this.state.phoneNumber = ev.target.value;
    }

    /**
     * Add digit to phone number
     */
    addDigit(digit) {
        this.state.phoneNumber += digit;
    }

    /**
     * Remove last digit
     */
    backspace() {
        this.state.phoneNumber = this.state.phoneNumber.slice(0, -1);
    }

    /**
     * Make a call
     */
    async makeCall() {
        if (!this.state.phoneNumber) {
            this.notification.add('Please enter a phone number', { type: 'warning' });
            return;
        }

        try {
            const result = await this.voip.makeCall(this.state.phoneNumber);
            if (result) {
                const voipClient = this.voip.getVoipClient();
                await voipClient.makeCall(this.state.phoneNumber);
                
                this.state.inCall = true;
                this.state.callDuration = 0;
                this.notification.add('Call initiated', { type: 'success' });
            }
        } catch (error) {
            console.error('Failed to make call:', error);
            this.notification.add('Failed to make call', { type: 'danger' });
        }
    }

    /**
     * Hang up call
     */
    async hangup() {
        try {
            const voipClient = this.voip.getVoipClient();
            await voipClient.hangup();
            await this.voip.hangupCall();
            
            this.state.inCall = false;
            this.state.callDuration = 0;
            this.state.phoneNumber = "";
            
            // Reload recent calls
            await this.loadRecentCalls();
            
            this.notification.add('Call ended', { type: 'info' });
        } catch (error) {
            console.error('Failed to hang up:', error);
        }
    }

    /**
     * Update call duration
     */
    updateCallDuration() {
        setInterval(() => {
            if (this.state.inCall) {
                this.state.callDuration++;
            }
        }, 1000);
    }

    /**
     * Format call duration
     */
    get formattedDuration() {
        const hours = Math.floor(this.state.callDuration / 3600);
        const minutes = Math.floor((this.state.callDuration % 3600) / 60);
        const seconds = this.state.callDuration % 60;
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Call a recent contact
     */
    async callRecent(phoneNumber) {
        this.state.phoneNumber = phoneNumber;
        await this.makeCall();
    }

    /**
     * Open call history
     */
    openCallHistory() {
        this.action.doAction({
            type: 'ir.actions.act_window',
            res_model: 'voip.call',
            views: [[false, 'list'], [false, 'form']],
            target: 'current',
        });
    }

    /**
     * Open VoIP settings
     */
    openSettings() {
        this.action.doAction({
            type: 'ir.actions.act_window',
            res_model: 'voip.user',
            views: [[false, 'form']],
            target: 'new',
            context: { search_default_my_config: 1 },
        });
    }
}

VoipSystray.template = "voip_webrtc_freepbx.VoipSystray";

export const systrayItem = {
    Component: VoipSystray,
};

registry.category("systray").add("voip_webrtc_freepbx.voip_systray", systrayItem, { sequence: 50 });
