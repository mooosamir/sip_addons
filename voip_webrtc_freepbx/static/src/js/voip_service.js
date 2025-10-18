/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";

export const voipService = {
    dependencies: ["rpc", "notification"],
    
    start(env, { rpc, notification }) {
        let voipClient = null;
        let currentCall = null;
        let config = null;

        /**
         * Initialize VoIP service and load configuration
         */
        async function initialize() {
            try {
                console.log('🔧 VoIP Service Debug: Initializing...');
                const result = await rpc('/voip/config', {});
                if (result.success) {
                    config = result.config;
                    console.log('🔧 VoIP Service Debug: Config loaded successfully', config);
                    return true;
                } else {
                    console.error('Failed to load VoIP config:', result.error);
                    return false;
                }
            } catch (error) {
                console.error('Error initializing VoIP:', error);
                return false;
            }
        }

        /**
         * Get VoIP configuration
         */
        function getConfig() {
            return config;
        }

        /**
         * Make an outbound call
         */
        async function makeCall(phoneNumber) {
            if (!voipClient) {
                notification.add('VoIP client not initialized', { type: 'danger' });
                return false;
            }

            try {
                const result = await rpc('/voip/call/create', {
                    direction: 'outbound',
                    from_number: config.user.username,
                    to_number: phoneNumber,
                });

                if (result.success) {
                    currentCall = result.call_id;
                    return result;
                } else {
                    notification.add(result.error, { type: 'danger' });
                    return false;
                }
            } catch (error) {
                console.error('Error making call:', error);
                notification.add('Failed to make call', { type: 'danger' });
                return false;
            }
        }

        /**
         * Answer incoming call
         */
        async function answerCall(callId) {
            try {
                const result = await rpc('/voip/call/update', {
                    call_id: callId,
                    state: 'in_progress',
                });

                if (result.success) {
                    currentCall = callId;
                    return true;
                } else {
                    notification.add(result.error, { type: 'danger' });
                    return false;
                }
            } catch (error) {
                console.error('Error answering call:', error);
                return false;
            }
        }

        /**
         * Hang up current call
         */
        async function hangupCall(reason = 'normal') {
            if (!currentCall) {
                return false;
            }

            try {
                const result = await rpc('/voip/call/update', {
                    call_id: currentCall,
                    state: 'completed',
                    hangup_reason: reason,
                });

                if (result.success) {
                    currentCall = null;
                    return true;
                } else {
                    notification.add(result.error, { type: 'danger' });
                    return false;
                }
            } catch (error) {
                console.error('Error hanging up call:', error);
                return false;
            }
        }

        /**
         * Get call history
         */
        async function getCallHistory(limit = 50, offset = 0) {
            try {
                const result = await rpc('/voip/call/list', {
                    limit: limit,
                    offset: offset,
                });

                if (result.success) {
                    return result.calls;
                } else {
                    console.error('Failed to get call history:', result.error);
                    return [];
                }
            } catch (error) {
                console.error('Error getting call history:', error);
                return [];
            }
        }

        /**
         * Search for partner by phone number
         */
        async function searchPartner(phoneNumber) {
            try {
                const result = await rpc('/voip/search/partner', {
                    phone: phoneNumber,
                });

                if (result.success) {
                    return result.partner;
                } else {
                    console.error('Failed to search partner:', result.error);
                    return null;
                }
            } catch (error) {
                console.error('Error searching partner:', error);
                return null;
            }
        }

        /**
         * Set VoIP client instance
         */
        function setVoipClient(client) {
            voipClient = client;
            console.log('🔧 VoIP Service Debug: Client set', client);
        }

        /**
         * Get VoIP client instance
         */
        function getVoipClient() {
            return voipClient;
        }

        /**
         * Get current call ID
         */
        function getCurrentCall() {
            return currentCall;
        }

        /**
         * Handle incoming call
         */
        function onIncomingCall(callData) {
            console.log('🔧 VoIP Service Debug: Incoming call received', callData);
            currentCall = callData.session;
            
            // DON'T show system notification - Custom UI will handle it
            // notification.add(`Incoming call from ${callData.from}`, {
            //     type: 'info',
            //     sticky: true,
            //     buttons: [
            //         {
            //             text: 'Answer',
            //             primary: true,
            //             onClick: () => answerCall(callData.session)
            //         },
            //         {
            //             text: 'Decline',
            //             onClick: () => hangupCall('declined')
            //         }
            //     ]
            // });
        }

        /**
         * Get contacts list
         */
        async function getContacts(limit = 100) {
            try {
                const result = await rpc('/voip/contacts/list', {
                    limit: limit,
                });

                if (result.success) {
                    return result.contacts;
                } else {
                    console.error('Failed to get contacts:', result.error);
                    return [];
                }
            } catch (error) {
                console.error('Error getting contacts:', error);
                return [];
            }
        }

        return {
            initialize,
            getConfig,
            makeCall,
            answerCall,
            hangupCall,
            getCallHistory,
            searchPartner,
            getContacts,
            setVoipClient,
            getVoipClient,
            getCurrentCall,
            onIncomingCall,
        };
    },
};

registry.category("services").add("voip", voipService);
