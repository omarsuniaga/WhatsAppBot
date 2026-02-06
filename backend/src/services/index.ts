/**
 * Services Index - Domain services that use repositories
 * 
 * These services contain business logic and do not depend on HTTP/UI.
 */

import { AttendanceService } from './AttendanceService';
import { EventLogService } from './EventLogService';
import { IdentityService } from './IdentityService';
import { SchedulingService } from './SchedulingService';
import { TemplateService } from './TemplateService';
import { TriggerService } from './TriggerService';
import AutomationService from './AutomationService';

// Export classes
export {
    AttendanceService,
    EventLogService,
    IdentityService,
    SchedulingService,
    TemplateService,
    TriggerService,
    AutomationService
};

// Export singleton instances for convenience
export const attendanceService = AttendanceService.getInstance();
export const eventLogService = EventLogService.getInstance();
export const identityService = IdentityService.getInstance();
export const schedulingService = SchedulingService.getInstance();
export const templateService = TemplateService.getInstance();
export const triggerService = TriggerService.getInstance();
export const automationService = AutomationService.getInstance();
