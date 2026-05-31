import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Plus, ArrowRight, Crown, Shield as LucideShield, Eye, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { FamilyGroup, FamilyMember } from '@shared/schema';

const createFamilySchema = z.object({
  name: z.string().min(1, 'Family name is required'),
  description: z.string().optional(),
  groupType: z.enum(['family', 'couple', 'household']).default('family'),
});

type CreateFamilyFormData = z.infer<typeof createFamilySchema>;

interface FamilyWithMemberInfo extends FamilyGroup {
  memberCount?: number;
  userRole?: string;
}

export default function FamilyList() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const createFamilyForm = useForm<CreateFamilyFormData, any, CreateFamilyFormData>({
    resolver: zodResolver(createFamilySchema) as any,
    defaultValues: {
      name: '',
      description: '',
      groupType: 'family',
    },
  });

  // Fetch user's families
  const { data: families = [], isLoading } = useQuery<FamilyWithMemberInfo[]>({
    queryKey: ['/api/families'],
  });

  // Create family mutation
  const createFamilyMutation = useMutation<any, any, CreateFamilyFormData>({
    mutationFn: async (data: CreateFamilyFormData) => {
      return apiRequest('/api/families', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families'] });
      toast({
        title: 'Family Created',
        description: 'Your family group has been created successfully.',
      });
      setIsCreateDialogOpen(false);
      createFamilyForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create family group',
        variant: 'destructive',
      });
    },
  });

  const handleCreateFamily = (data: CreateFamilyFormData) => {
    createFamilyMutation.mutate(data);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <LucideShield className="h-4 w-4" />;
      case 'member':
        return <User className="h-4 w-4" />;
      case 'view_only':
        return <Eye className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'view_only':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground flex items-center gap-3" data-testid="title-family-list">
                <Users className="h-10 w-10 text-blue-600" />
                Family Groups
              </h1>
              <p className="text-muted-foreground mt-2">
                Collaborate with your family on financial goals and budgets
              </p>
            </div>

            {/* Create Family Button */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-family">
                  <Plus className="h-4 w-4" />
                  Create New Family
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-family">
                <DialogHeader>
                  <DialogTitle>Create New Family Group</DialogTitle>
                  <DialogDescription>
                    Start collaborating with your family on financial planning
                  </DialogDescription>
                </DialogHeader>
                <Form {...createFamilyForm}>
                  <form onSubmit={createFamilyForm.handleSubmit(handleCreateFamily)} className="space-y-4">
                    <FormField
                      control={createFamilyForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Family Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Smith Family"
                              data-testid="input-family-name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createFamilyForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Brief description of your family group"
                              data-testid="input-family-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel-create"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createFamilyMutation.isPending}
                        data-testid="button-submit-create"
                      >
                        {createFamilyMutation.isPending ? 'Creating...' : 'Create Family'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Family List */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} data-testid={`skeleton-family-card-${i}`}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : families.length === 0 ? (
          <Card className="text-center py-12" data-testid="card-no-families">
            <CardContent>
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Family Groups Yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Create your first family group to start collaborating on financial goals
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="gap-2"
                data-testid="button-create-first-family"
              >
                <Plus className="h-4 w-4" />
                Create Your First Family
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {families.map((family) => (
              <Card
                key={family.id}
                className="hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => setLocation(`/families/${family.id}`)}
                data-testid={`card-family-${family.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl group-hover:text-blue-600 transition-colors" data-testid={`text-family-name-${family.id}`}>
                        {family.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {family.groupType === 'family' && 'Family'}
                        {family.groupType === 'couple' && 'Couple'}
                        {family.groupType === 'household' && 'Household'}
                      </CardDescription>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardHeader>
                <CardContent>
                  {family.description && (
                    <p className="text-sm text-muted-foreground mb-4" data-testid={`text-family-description-${family.id}`}>
                      {family.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span data-testid={`text-member-count-${family.id}`}>
                        {family.memberCount || 0} {family.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>
                    {family.userRole && (
                      <Badge
                        className={`gap-1 ${getRoleBadgeColor(family.userRole)}`}
                        data-testid={`badge-role-${family.id}`}
                      >
                        {getRoleIcon(family.userRole)}
                        {family.userRole.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
