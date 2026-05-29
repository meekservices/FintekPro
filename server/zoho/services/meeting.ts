import { ZohoApiClient } from '../api-client';

interface ZohoMeeting {
  meeting_key?: string;
  topic: string;
  agenda?: string;
  start_time: string;
  duration: number;
  timezone?: string;
  presenter?: string;
  password?: string;
  join_url?: string;
  embed_url?: string;
  registration_url?: string;
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled';
  participants?: ZohoMeetingParticipant[];
  recording_url?: string;
}

interface ZohoWebinar {
  webinar_key?: string;
  topic: string;
  agenda?: string;
  start_time: string;
  duration: number;
  timezone?: string;
  presenter?: string;
  registration_required?: boolean;
  max_registrants?: number;
  join_url?: string;
  registration_url?: string;
  status?: 'scheduled' | 'live' | 'completed' | 'cancelled';
  registrant_count?: number;
  attendee_count?: number;
}

interface ZohoMeetingParticipant {
  email: string;
  name: string;
  role?: 'host' | 'co-host' | 'participant';
  join_time?: string;
  leave_time?: string;
  duration?: number;
}

interface ZohoWebinarRegistrant {
  registrant_key?: string;
  email: string;
  first_name: string;
  last_name?: string;
  company?: string;
  phone?: string;
  custom_questions?: Record<string, string>;
  registered_time?: string;
  status?: 'registered' | 'attended' | 'no_show';
}

export class ZohoMeetingService {
  private client: ZohoApiClient;
  private zsoid: string;

  constructor(connectionId: string, dataCenter: string = 'in', zsoid?: string) {
    this.client = new ZohoApiClient(connectionId, 'Meeting', dataCenter);
    this.zsoid = zsoid || '';
  }

  /**
   * Set ZSOID after construction (for routes that fetch it from connection)
   */
  setZsoid(zsoid: string): void {
    this.zsoid = zsoid;
  }

  /**
   * Get API base path with ZSOID included
   */
  private getBasePath(): string {
    if (!this.zsoid) {
      throw new Error('ZSOID not configured - cannot make Meeting API requests');
    }
    return `/api/v2/${this.zsoid}`;
  }

  // ==================== Meetings ====================

  async getMeetings(options?: {
    status?: 'upcoming' | 'past' | 'live';
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ZohoMeeting[]> {
    const params: any = {};
    if (options?.status) params.status = options.status;
    if (options?.fromDate) params.from_date = options.fromDate.toISOString().split('T')[0];
    if (options?.toDate) params.to_date = options.toDate.toISOString().split('T')[0];

    const response = await this.client.get(`${this.getBasePath()}/sessions.json`, { params });
    return response.data?.session || [];
  }

  async getMeetingDetails(meetingKey: string): Promise<ZohoMeeting | null> {
    const response = await this.client.get(`${this.getBasePath()}/sessions/${meetingKey}.json`);
    return response.data?.session || null;
  }

  async createMeeting(meeting: {
    topic: string;
    agenda?: string;
    startTime: Date;
    duration: number;
    timezone?: string;
    participants?: Array<{email: string; name: string}>;
  }): Promise<ZohoMeeting> {
    const payload = {
      session: {
        topic: meeting.topic,
        agenda: meeting.agenda || '',
        start_time: meeting.startTime.toISOString(),
        duration: meeting.duration,
        timezone: meeting.timezone || 'Asia/Kolkata',
        presenter: 'self',
      }
    };

    const response = await this.client.post(`${this.getBasePath()}/sessions.json`, payload);
    
    if (!response.data?.session) {
      throw new Error('Failed to create meeting');
    }

    const createdMeeting = response.data.session;

    if (meeting.participants && meeting.participants.length > 0) {
      await this.inviteParticipants(createdMeeting.meeting_key, meeting.participants);
    }

    return createdMeeting;
  }

  async updateMeeting(meetingKey: string, updates: Partial<{
    topic: string;
    agenda: string;
    startTime: Date;
    duration: number;
  }>): Promise<ZohoMeeting> {
    const payload: any = { session: {} };
    if (updates.topic) payload.session.topic = updates.topic;
    if (updates.agenda) payload.session.agenda = updates.agenda;
    if (updates.startTime) payload.session.start_time = updates.startTime.toISOString();
    if (updates.duration) payload.session.duration = updates.duration;

    const response = await this.client.put(`${this.getBasePath()}/sessions/${meetingKey}.json`, payload);
    return response.data?.session || null;
  }

  async deleteMeeting(meetingKey: string): Promise<boolean> {
    const response = await this.client.delete(`${this.getBasePath()}/sessions/${meetingKey}.json`);
    return Number(response.status) === 200 || Number(response.status) === 204;
  }

  async inviteParticipants(meetingKey: string, participants: Array<{
    email: string;
    name: string;
  }>): Promise<boolean> {
    const response = await this.client.post(`${this.getBasePath()}/sessions/${meetingKey}/participants.json`, {
      participants: participants.map(p => ({
        email: p.email,
        name: p.name,
        role: 'participant',
      }))
    });
    return response.data?.status === 'success';
  }

  async getMeetingParticipants(meetingKey: string): Promise<ZohoMeetingParticipant[]> {
    const response = await this.client.get(`${this.getBasePath()}/sessions/${meetingKey}/participants.json`);
    return response.data?.participants || [];
  }

  async getMeetingRecording(meetingKey: string): Promise<string | null> {
    const response = await this.client.get(`${this.getBasePath()}/sessions/${meetingKey}/recording.json`);
    return response.data?.recording_url || null;
  }

  // ==================== Webinars ====================

  async getWebinars(options?: {
    status?: 'upcoming' | 'past' | 'live';
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ZohoWebinar[]> {
    const params: any = {};
    if (options?.status) params.status = options.status;
    if (options?.fromDate) params.from_date = options.fromDate.toISOString().split('T')[0];
    if (options?.toDate) params.to_date = options.toDate.toISOString().split('T')[0];

    const response = await this.client.get(`${this.getBasePath()}/webinar.json`, { params });
    return response.data?.session || [];
  }

  async getWebinarDetails(webinarKey: string): Promise<ZohoWebinar | null> {
    const response = await this.client.get(`${this.getBasePath()}/webinar/${webinarKey}.json`);
    return response.data?.session || null;
  }

  async createWebinar(webinar: {
    topic: string;
    agenda?: string;
    startTime: Date;
    duration: number;
    timezone?: string;
    registrationRequired?: boolean;
    maxRegistrants?: number;
  }): Promise<ZohoWebinar> {
    const payload = {
      session: {
        topic: webinar.topic,
        agenda: webinar.agenda || '',
        start_time: webinar.startTime.toISOString(),
        duration: webinar.duration,
        timezone: webinar.timezone || 'Asia/Kolkata',
        registration_required: webinar.registrationRequired ?? true,
        max_registrants: webinar.maxRegistrants || 100,
      }
    };

    const response = await this.client.post(`${this.getBasePath()}/webinar.json`, payload);
    
    if (!response.data?.session) {
      throw new Error('Failed to create webinar');
    }

    return response.data.session;
  }

  async registerForWebinar(webinarKey: string, registrant: ZohoWebinarRegistrant): Promise<string> {
    const response = await this.client.post(`${this.getBasePath()}/webinar/${webinarKey}/registrants.json`, {
      registrant: {
        email: registrant.email,
        first_name: registrant.first_name,
        last_name: registrant.last_name || '',
        company: registrant.company || '',
        phone: registrant.phone || '',
        ...registrant.custom_questions,
      }
    });

    if (!response.data?.registrant_key) {
      throw new Error('Failed to register for webinar');
    }

    return response.data.registrant_key;
  }

  async getWebinarRegistrants(webinarKey: string): Promise<ZohoWebinarRegistrant[]> {
    const response = await this.client.get(`${this.getBasePath()}/webinar/${webinarKey}/registrants.json`);
    return response.data?.registrants || [];
  }

  async getWebinarAttendees(webinarKey: string): Promise<ZohoWebinarRegistrant[]> {
    const response = await this.client.get(`${this.getBasePath()}/webinar/${webinarKey}/attendees.json`);
    return response.data?.attendees || [];
  }

  // ==================== FintekPro Integration ====================

  async createClientMeeting(options: {
    clientName: string;
    clientEmail: string;
    agentName: string;
    purpose: string;
    startTime: Date;
    duration?: number;
  }): Promise<{meeting: ZohoMeeting; joinUrl: string}> {
    const topic = `${options.purpose} - ${options.clientName}`;
    const agenda = `Meeting with ${options.clientName} regarding ${options.purpose}. Agent: ${options.agentName}`;

    const meeting = await this.createMeeting({
      topic,
      agenda,
      startTime: options.startTime,
      duration: options.duration || 30,
      participants: [{ email: options.clientEmail, name: options.clientName }],
    });

    return {
      meeting,
      joinUrl: meeting.join_url || '',
    };
  }

  async createInvestorWebinar(options: {
    topic: string;
    description: string;
    startTime: Date;
    duration: number;
    maxAttendees?: number;
  }): Promise<{webinar: ZohoWebinar; registrationUrl: string}> {
    const webinar = await this.createWebinar({
      topic: options.topic,
      agenda: options.description,
      startTime: options.startTime,
      duration: options.duration,
      registrationRequired: true,
      maxRegistrants: options.maxAttendees || 500,
    });

    return {
      webinar,
      registrationUrl: webinar.registration_url || '',
    };
  }

  async bulkRegisterClients(webinarKey: string, clients: Array<{
    email: string;
    name: string;
    phone?: string;
  }>): Promise<{success: number; failed: number}> {
    let success = 0;
    let failed = 0;

    for (const client of clients) {
      try {
        const nameParts = client.name.split(' ');
        await this.registerForWebinar(webinarKey, {
          email: client.email,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          phone: client.phone,
        });
        success++;
      } catch (error) {
        console.error(`Failed to register ${client.email}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}

export const createZohoMeetingService = (connectionId: string, dataCenter: string = 'in') => {
  return new ZohoMeetingService(connectionId, dataCenter);
};
