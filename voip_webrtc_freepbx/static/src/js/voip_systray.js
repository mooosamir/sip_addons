/** @odoo-module **/

import { Component, useState, onWillStart, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { VoipSipClient } from "./voip_sip_client";

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
            incomingCall: false,
            incomingCallNumber: "",
            callDuration: 0,
            recentCalls: [],
            canControlRecording: false,
            autoStartRecording: false,
            isRecording: false,
            // Call controls state
            isMuted: false,
            isSpeaker: false,
            // Tabs state
            activeTab: 'dialer', // 'dialer', 'history', 'contacts'
            contacts: [],
            searchQuery: '',
            // Position state for draggable dialer
            position: { x: null, y: null },
            isDragging: false,
        });

        onWillStart(async () => {
            await this.initializeVoip();
        });

        onMounted(() => {
            this.updateCallDuration();
            console.log('🔧 VoIP Systray Debug: Component mounted, isRegistered:', this.state.isRegistered);
            
            // Setup incoming call handler
            this.voip.onIncomingCall = this.onIncomingCall.bind(this);
            
            // Setup call terminated handler
            this.voip.onCallTerminated = this.onCallTerminated.bind(this);
        });
    }

    /**
     * Initialize VoIP client
     */
    async initializeVoip() {
        try {
            console.log('🔧 VoIP Systray Debug: Initializing VoIP...');
            const initialized = await this.voip.initialize();
            if (initialized) {
                const config = this.voip.getConfig();
                console.log('🔧 VoIP Systray Debug: Config loaded', config);
                const voipClient = new VoipSipClient(config, this.voip);
                await voipClient.initialize();
                
                this.voip.setVoipClient(voipClient);
                this.state.isInitialized = true;
                console.log('🔧 VoIP Systray Debug: VoIP initialized successfully');
                this.state.isRegistered = voipClient.isClientRegistered();
                console.log('🔧 VoIP Systray Debug: Registration status:', this.state.isRegistered);
                
                // Force UI update
                this.state.isRegistered = true;
                console.log('🔧 VoIP Systray Debug: Force UI update, isRegistered:', this.state.isRegistered);
                
                // Load recording settings
                this.state.canControlRecording = voipClient.config.user.can_control_recording;
                this.state.autoStartRecording = voipClient.config.user.auto_start_recording;
                console.log('🔧 VoIP Systray Debug: Recording settings loaded', {
                    canControl: this.state.canControlRecording,
                    autoStart: this.state.autoStartRecording
                });
                
                // Load recent calls
                await this.loadRecentCalls();
                
                // this.notification.add('VoIP connected successfully', { type: 'success' });
            }
        } catch (error) {
            console.error('Failed to initialize VoIP:', error);
            
            // Show user-friendly error
            const errorMsg = error.message || 'Failed to initialize VoIP';
            this.notification.add(errorMsg, { type: 'danger' });
            
            // Show HTTPS requirement if applicable
            if (errorMsg.includes('HTTPS') || errorMsg.includes('WebRTC')) {
                this.notification.add(
                    'VoIP requires HTTPS connection. Please access Odoo via HTTPS.',
                    { type: 'warning', sticky: true }
                );
            }
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
    toggleDialer(ev) {
        console.log('🔧 Toggle Dialer clicked');
        this.state.showDialer = !this.state.showDialer;
        console.log('🔧 showDialer is now:', this.state.showDialer);
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
        console.log('🔧 VoIP Systray Debug: ===== ADD DIGIT =====');
        console.log('🔧 VoIP Systray Debug: Adding digit:', digit);
        console.log('🔧 VoIP Systray Debug: Current phone number:', this.state.phoneNumber);
        console.log('🔧 VoIP Systray Debug: In call state:', this.state.inCall);
        console.log('🔧 VoIP Systray Debug: Show dialer:', this.state.showDialer);
        
        // Just add the digit, don't make call
        this.state.phoneNumber += digit;
        
        console.log('🔧 VoIP Systray Debug: New phone number:', this.state.phoneNumber);
        console.log('🔧 VoIP Systray Debug: Phone number length:', this.state.phoneNumber.length);
        console.log('🔧 VoIP Systray Debug: ===== ADD DIGIT END =====');
        
        // Check if this triggers any automatic behavior
        console.log('🔧 VoIP Systray Debug: Checking if any auto-call is triggered...');
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
        const startTime = Date.now();
        console.log('🔧 VoIP Systray Debug: ===== MAKE CALL =====', new Date().toISOString());
        console.log('🔧 VoIP Systray Debug: Phone number:', this.state.phoneNumber);
        
        if (!this.state.phoneNumber || this.state.phoneNumber.length < 3) {
            this.notification.add('Please enter a valid phone number (at least 3 digits)', { type: 'warning' });
            return;
        }

        try {
            const voipClient = this.voip.getVoipClient();
            console.log('⏱️ Systray: Got VoIP client at:', Date.now() - startTime, 'ms');
            
            // Update UI immediately for better responsiveness
            this.state.inCall = true;
            this.state.callDuration = 0;
            console.log('⏱️ Systray: UI updated at:', Date.now() - startTime, 'ms');
            
            // Start SIP call immediately (don't wait for Odoo record)
            console.log('🔧 VoIP Systray Debug: Starting SIP call immediately...');
            console.log('⏱️ Systray: Calling voipClient.makeCall at:', Date.now() - startTime, 'ms');
            const sipCallPromise = voipClient.makeCall(this.state.phoneNumber);
            
            // Create Odoo record in parallel (non-blocking)
            console.log('🔧 VoIP Systray Debug: Creating Odoo record in parallel...');
            console.log('⏱️ Systray: Starting Odoo record creation at:', Date.now() - startTime, 'ms');
            this.voip.makeCall(this.state.phoneNumber).then(result => {
                const odooTime = Date.now() - startTime;
                if (result && result.call_id) {
                    voipClient.odooCallId = result.call_id;
                    console.log('🔧 VoIP Systray Debug: Odoo call ID stored:', result.call_id);
                    console.log('⏱️ Systray: Odoo record created at:', odooTime, 'ms');
                }
            }).catch(error => {
                console.error('🔧 VoIP Systray Debug: Failed to create Odoo record:', error);
                // Don't block the call if Odoo record creation fails
            });
            
            // Wait only for SIP call to start
            console.log('⏱️ Systray: Waiting for SIP call to start...');
            await sipCallPromise;
            console.log('⏱️ Systray: SIP call started at:', Date.now() - startTime, 'ms');
            
            this.notification.add('📞 Call initiated', { type: 'success' });
            console.log('⏱️ Systray: TOTAL TIME:', Date.now() - startTime, 'ms');
            
        } catch (error) {
            console.error('🔧 VoIP Systray Debug: Failed to make call:', error);
            
            // Reset state on error
            this.state.inCall = false;
            
            // Show simplified error message
            const errorMessage = error.message || 'Failed to make call. Please check your settings.';
            
            // For busy/unavailable errors, show simple message (busy tone is already playing)
            if (errorMessage.includes('Busy') || errorMessage.includes('Unavailable') || errorMessage.includes('503') || errorMessage.includes('486')) {
                this.notification.add('📵 Number is busy or unavailable', { 
                    type: 'warning',
                    title: 'Call Failed'
                });
            } else if (errorMessage.includes('HTTPS')) {
                this.notification.add(
                    'VoIP calls require a secure HTTPS connection. Please access Odoo via HTTPS.',
                    { type: 'warning', sticky: true }
                );
            } else if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
                this.notification.add('📵 Invalid phone number or extension', { 
                    type: 'warning',
                    title: 'Call Failed'
                });
            } else if (errorMessage.includes('Timeout') || errorMessage.includes('408')) {
                this.notification.add('📵 No response from server', { 
                    type: 'warning',
                    title: 'Call Failed'
                });
            } else {
                // Generic error
                this.notification.add(`📵 ${errorMessage}`, { 
                    type: 'danger',
                    title: 'Call Failed'
                });
            }
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
            
            // this.notification.add('Call ended', { type: 'info' });
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
     * Start call timer
     */
    startCallTimer() {
        this.state.callDuration = 0;
        this.state.callStartTime = Date.now();
    }

    /**
     * Handle incoming call
     */
    onIncomingCall(callData) {
        console.log('🔧 VoIP Systray Debug: Incoming call received', callData);
        
        // Set incoming call state
        this.state.incomingCall = true;
        this.state.incomingCallNumber = callData.from;
        
        // Auto-open dropdown to show incoming call screen
        this.state.showDialer = true;
        
        // Store the session for later use
        this.currentSession = callData.session;
        
        // DON'T show system notification - Custom UI in dropdown will handle it
        // Only show the custom incoming call screen in the dropdown
        console.log('🔧 VoIP Systray Debug: Dropdown opened for incoming call');
    }

    /**
     * Handle call terminated
     */
    onCallTerminated(session) {
        console.log('🔧 VoIP Systray Debug: ===== CALL TERMINATED IN SYSTRAY =====');
        console.log('🔧 VoIP Systray Debug: Session:', session);
        console.log('🔧 VoIP Systray Debug: Current UI state - inCall:', this.state.inCall);
        console.log('🔧 VoIP Systray Debug: Current UI state - incomingCall:', this.state.incomingCall);
        
        // Reset call state but keep dialer open
        this.state.inCall = false;
        this.state.incomingCall = false;
        this.state.phoneNumber = '';
        this.state.callDuration = 0;
        this.state.isRecording = false;
        this.state.isMuted = false;
        this.state.isSpeaker = false;
        
        // Switch to dialer tab
        this.state.activeTab = 'dialer';
        
        // DON'T close dialer - keep it open
        // this.state.showDialer = false;  ← REMOVED
        
        console.log('🔧 VoIP Systray Debug: UI state reset - inCall:', this.state.inCall);
        console.log('🔧 VoIP Systray Debug: Dialer kept open - showDialer:', this.state.showDialer);
        console.log('🔧 VoIP Systray Debug: ===== CALL TERMINATED IN SYSTRAY END =====');
        
        // this.notification.add('📴 Call ended', { type: 'info' });
        
        // Reload recent calls to show the completed call
        this.loadRecentCalls();
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
     * Answer incoming call
     */
    async answerCall(session) {
        try {
            console.log('🔧 VoIP Systray Debug: Answering call', session);
            const voipClient = this.voip.getVoipClient();
            
            if (!voipClient) {
                throw new Error('VoIP client not initialized');
            }
            
            // Update UI immediately for better responsiveness
            this.state.inCall = true;
            this.state.incomingCall = false;
            this.startCallTimer();
            
            // Answer SIP call immediately (don't wait for Odoo record)
            console.log('🔧 VoIP Systray Debug: Answering SIP call immediately...');
            const answerPromise = voipClient.answerCall();
            
            // Create Odoo record in parallel (non-blocking)
            console.log('🔧 VoIP Systray Debug: Creating Odoo record in parallel...');
            this.voip.makeCall(this.state.incomingCallNumber || 'Unknown').then(result => {
                if (result && result.call_id) {
                    voipClient.odooCallId = result.call_id;
                    console.log('🔧 VoIP Systray Debug: Odoo call ID stored:', result.call_id);
                }
            }).catch(error => {
                console.error('🔧 VoIP Systray Debug: Failed to create Odoo record:', error);
                // Don't block the call if Odoo record creation fails
            });
            
            // Wait only for SIP answer
            await answerPromise;
            
            console.log('🔧 VoIP Systray Debug: Call answered successfully');
            // this.notification.add('✅ Call answered', { type: 'success' });
            
        } catch (error) {
            console.error('🔧 VoIP Systray Debug: Failed to answer call:', error);
            
            // Reset state on error
            this.state.inCall = false;
            this.state.incomingCall = true;
            
            this.notification.add(`❌ Failed to answer call: ${error.message}`, { type: 'danger' });
        }
    }

    /**
     * Decline incoming call
     */
    async declineCall(session) {
        try {
            console.log('🔧 VoIP Systray Debug: Declining call', session);
            const voipClient = this.voip.getVoipClient();
            
            if (!voipClient) {
                throw new Error('VoIP client not initialized');
            }
            
            console.log('🔧 VoIP Systray Debug: Calling hangup on client');
            await voipClient.hangup();
            
            console.log('🔧 VoIP Systray Debug: Call declined successfully');
            this.state.inCall = false;
            this.state.incomingCall = false;
            this.state.phoneNumber = '';
            this.state.showDialer = false;
            
            this.notification.add('❌ Call declined', { type: 'info' });
        } catch (error) {
            console.error('🔧 VoIP Systray Debug: Failed to decline call:', error);
            this.notification.add(`❌ Failed to decline call: ${error.message}`, { type: 'danger' });
        }
    }

    /**
     * Start recording
     */
    async startRecording() {
        try {
            console.log('🔧 VoIP Systray Debug: Starting recording');
            const voipClient = this.voip.getVoipClient();
            
            if (!voipClient) {
                throw new Error('VoIP client not initialized');
            }
            
            await voipClient.startRecording();
            this.state.isRecording = true;
            
            console.log('🔧 VoIP Systray Debug: Recording state updated:', this.state.isRecording);
            this.notification.add('🔴 Recording started', { type: 'info' });
        } catch (error) {
            console.error('🔧 VoIP Systray Debug: Failed to start recording:', error);
            this.notification.add(`❌ Failed to start recording: ${error.message}`, { type: 'danger' });
        }
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        try {
            console.log('🔧 VoIP Systray Debug: Stopping recording');
            const voipClient = this.voip.getVoipClient();
            
            if (!voipClient) {
                throw new Error('VoIP client not initialized');
            }
            
            await voipClient.stopRecording();
            this.state.isRecording = false;
            
            this.notification.add('⏹️ Recording stopped', { type: 'success' });
        } catch (error) {
            console.error('🔧 VoIP Systray Debug: Failed to stop recording:', error);
            this.notification.add(`❌ Failed to stop recording: ${error.message}`, { type: 'danger' });
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

    /**
     * Switch active tab
     */
    switchTab(tab) {
        this.state.activeTab = tab;
        if (tab === 'contacts' && this.state.contacts.length === 0) {
            this.loadContacts();
        }
        if (tab === 'history') {
            this.loadRecentCalls();
        }
    }

    /**
     * Load contacts from Odoo
     */
    async loadContacts() {
        try {
            const contacts = await this.voip.getContacts();
            this.state.contacts = contacts || [];
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    }

    /**
     * Filter contacts based on search query
     */
    get filteredContacts() {
        if (!this.state.searchQuery) {
            return this.state.contacts;
        }
        const query = this.state.searchQuery.toLowerCase();
        return this.state.contacts.filter(contact => 
            (contact.name && contact.name.toLowerCase().includes(query)) ||
            (contact.phone && contact.phone.toLowerCase().includes(query))
        );
    }

    /**
     * Call a contact
     */
    async callContact(phoneNumber) {
        this.state.phoneNumber = phoneNumber;
        this.state.activeTab = 'dialer';
        await this.makeCall();
    }

    /**
     * Start dragging the dialer
     */
    startDrag(ev) {
        ev.preventDefault();
        
        // Get current position from DOM if not set
        if (this.state.position.x === null || this.state.position.y === null) {
            const dialerEl = ev.target.closest('.o_voip_phone_container');
            if (dialerEl) {
                const rect = dialerEl.getBoundingClientRect();
                this.state.position.x = rect.left;
                this.state.position.y = rect.top;
            }
        }
        
        this.state.isDragging = true;
        this.dragStartX = ev.clientX - (this.state.position.x || 0);
        this.dragStartY = ev.clientY - (this.state.position.y || 0);
        
        const boundOnDrag = this.onDrag.bind(this);
        const boundStopDrag = this.stopDrag.bind(this);
        
        document.addEventListener('mousemove', boundOnDrag);
        document.addEventListener('mouseup', boundStopDrag);
        
        // Store bound functions for cleanup
        this.boundOnDrag = boundOnDrag;
        this.boundStopDrag = boundStopDrag;
    }

    /**
     * Handle drag movement
     */
    onDrag(ev) {
        if (this.state.isDragging) {
            this.state.position.x = ev.clientX - this.dragStartX;
            this.state.position.y = ev.clientY - this.dragStartY;
        }
    }

    /**
     * Stop dragging
     */
    stopDrag() {
        this.state.isDragging = false;
        
        // Remove event listeners using stored bound functions
        if (this.boundOnDrag) {
            document.removeEventListener('mousemove', this.boundOnDrag);
        }
        if (this.boundStopDrag) {
            document.removeEventListener('mouseup', this.boundStopDrag);
        }
    }

    /**
     * Toggle minimize - Hide/Show entire dialer
     */
    toggleMinimize(ev) {
        console.log('🔧 Close button clicked');
        this.state.showDialer = false;
        console.log('🔧 showDialer is now:', this.state.showDialer);
    }

    /**
     * Get dialer position style
     */
    get dialerStyle() {
        if (this.state.position.x !== null && this.state.position.y !== null) {
            return `position: fixed; left: ${this.state.position.x}px; top: ${this.state.position.y}px; right: auto; transform: none;`;
        }
        return '';
    }

    /**
     * Toggle mute
     */
    async toggleMute() {
        try {
            const voipClient = this.voip.getVoipClient();
            
            if (!voipClient || !voipClient.currentSession) {
                console.error('No active call to mute');
                return;
            }

            const session = voipClient.currentSession;
            const pc = session.sessionDescriptionHandler.peerConnection;
            
            if (pc) {
                // Get local audio tracks
                const senders = pc.getSenders();
                const audioSender = senders.find(sender => sender.track && sender.track.kind === 'audio');
                
                if (audioSender && audioSender.track) {
                    // Toggle mute state
                    this.state.isMuted = !this.state.isMuted;
                    audioSender.track.enabled = !this.state.isMuted;
                    
                    console.log('🔇 Mute toggled:', this.state.isMuted);
                    // this.notification.add(
                    //     this.state.isMuted ? '🔇 Microphone muted' : '🎤 Microphone unmuted',
                    //     { type: 'info' }
                    // );
                }
            }
        } catch (error) {
            console.error('Failed to toggle mute:', error);
            this.notification.add('Failed to toggle mute', { type: 'warning' });
        }
    }

    /**
     * Toggle speaker
     */
    async toggleSpeaker() {
        try {
            this.state.isSpeaker = !this.state.isSpeaker;
            
            // In browser, speaker is default output
            // This is more of a visual indicator
            console.log('🔊 Speaker toggled:', this.state.isSpeaker);
            
            // this.notification.add(
            //     this.state.isSpeaker ? '🔊 Speaker on' : '🔉 Speaker off',
            //     { type: 'info' }
            // );
        } catch (error) {
            console.error('Failed to toggle speaker:', error);
        }
    }
}

VoipSystray.template = "voip_webrtc_freepbx.VoipSystray";
VoipSystray.props = {};

export const systrayItem = {
    Component: VoipSystray,
};

registry.category("systray").add("voip_webrtc_freepbx.voip_systray", systrayItem, { sequence: 50 });
