import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, BookOpen, Clock, CheckCircle } from 'lucide-react';

interface TutorialTriggerProps {
  onStart: () => void;
  isCompleted: boolean;
}

export function TutorialTrigger({ onStart, isCompleted }: TutorialTriggerProps) {
  return (
    <Card className="border-l-4 border-l-finance-blue bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <BookOpen className="h-5 w-5 mr-2 text-finance-blue" />
            Platform Tutorial
            {isCompleted && <CheckCircle className="h-4 w-4 ml-2 text-finance-green" />}
          </div>
          <Badge className={isCompleted ? "bg-finance-green" : "bg-finance-blue"}>
            {isCompleted ? "Completed" : "New"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          {isCompleted 
            ? "Great job! You've completed the tutorial. Take it again anytime to refresh your knowledge."
            : "New to FinanceHub? Take our interactive 5-minute walkthrough to discover all the powerful features and get the most out of your financial platform."
          }
        </p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center text-xs text-gray-500">
            <Clock className="h-3 w-3 mr-1" />
            5-7 minutes
          </div>
          
          <Button 
            onClick={onStart}
            className="bg-finance-blue hover:bg-blue-700"
            data-testid="start-tutorial"
          >
            <Play className="h-4 w-4 mr-2" />
            {isCompleted ? "Retake Tutorial" : "Start Tutorial"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}