// components/ui/confirmation-dialog.tsx
'use client';

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type DialogType = 'confirmation' | 'alert' | 'error';

interface DialogButton {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
}

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DialogType;
  title: string;
  description?: string | ReactNode;
  buttons: DialogButton[]; // até 3 botões
}

const typeConfig = {
  confirmation: {
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  alert: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  error: {
    icon: XCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  type,
  title,
  description,
  buttons,
}: ConfirmationDialogProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  // Limitar a 3 botões
  const displayButtons = buttons.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={`${config.bgColor} p-2 rounded-full shrink-0`}>
              <Icon className={`h-6 w-6 ${config.iconColor}`} />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-left">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-left mt-2">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          {displayButtons.map((button, index) => (
            <Button
              key={index}
              variant={button.variant || 'default'}
              onClick={() => {
                button.onClick();
                onOpenChange(false);
              }}
              className="w-full sm:w-auto"
            >
              {button.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}