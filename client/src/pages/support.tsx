import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Phone, Mail, Clock } from 'lucide-react';
import { Header } from '@/components/layout/header';

const supportTicketSchema = z.object({
  clientName: z.string().min(1, 'Name is required'),
  clientEmail: z.string().email('Valid email is required'),
  clientPhone: z.string().optional(),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  priority: z.string().default('medium')
});

type SupportTicketFormData = z.infer<typeof supportTicketSchema>;

export default function Support() {
  const { toast } = useToast();

  const form = useForm<SupportTicketFormData>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      subject: '',
      description: '',
      category: '',
      priority: 'medium'
    }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: SupportTicketFormData) => {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create support ticket');
      return response.json();
    },
    onSuccess: (ticket) => {
      toast({
        title: 'Support ticket created',
        description: `Your ticket ${ticket.ticketNumber} has been created successfully. We'll get back to you soon!`
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create ticket',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (data: SupportTicketFormData) => {
    createTicketMutation.mutate(data);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900" data-testid="support-page-title">
              Get Support
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              Need help? Create a support ticket and our team will assist you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Support Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Create Support Ticket
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="clientName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-client-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="clientEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" data-testid="input-client-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="clientPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-client-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-ticket-category">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="technical">Technical Issue</SelectItem>
                                  <SelectItem value="billing">Billing & Payments</SelectItem>
                                  <SelectItem value="product_inquiry">Product Inquiry</SelectItem>
                                  <SelectItem value="complaint">Complaint</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-ticket-priority">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-ticket-subject" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder="Please describe your issue in detail..."
                                className="min-h-[120px]"
                                data-testid="textarea-ticket-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end">
                        <Button 
                          type="submit" 
                          disabled={createTicketMutation.isPending}
                          data-testid="button-create-ticket"
                        >
                          {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Support Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium">Phone Support</p>
                      <p className="text-sm text-gray-600">+91-1800-123-456</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-green-600 mr-3" />
                    <div>
                      <p className="font-medium">Email Support</p>
                      <p className="text-sm text-gray-600">support@financehub.com</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 text-purple-600 mr-3" />
                    <div>
                      <p className="font-medium">Support Hours</p>
                      <p className="text-sm text-gray-600">Mon-Fri: 9 AM - 6 PM IST</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Times</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-green-100 text-green-800">Low Priority</Badge>
                    <span className="text-sm text-gray-600">2-3 business days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-yellow-100 text-yellow-800">Medium Priority</Badge>
                    <span className="text-sm text-gray-600">1-2 business days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-orange-100 text-orange-800">High Priority</Badge>
                    <span className="text-sm text-gray-600">4-8 hours</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge className="bg-red-100 text-red-800">Urgent</Badge>
                    <span className="text-sm text-gray-600">1-2 hours</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>FAQ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium">How can I track my ticket?</p>
                      <p className="text-gray-600">You'll receive a ticket number via email to track progress.</p>
                    </div>
                    <div>
                      <p className="font-medium">Can I update my ticket?</p>
                      <p className="text-gray-600">Reply to the email notification to add more information.</p>
                    </div>
                    <div>
                      <p className="font-medium">Emergency support?</p>
                      <p className="text-gray-600">For urgent issues, call our support hotline directly.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}