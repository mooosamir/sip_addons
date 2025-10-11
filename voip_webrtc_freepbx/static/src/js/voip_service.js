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
                const result = await rpc('/voip/config', {});
                if (result.success) {
                    config = result.config;
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

        return {
            initialize,
            getConfig,
            makeCall,
            answerCall,
            hangupCall,
            getCallHistory,
            searchPartner,
            setVoipClient,
            getVoipClient,
            getCurrentCall,
        };
    },
};

registry.category("services").add("voip", voipService);
