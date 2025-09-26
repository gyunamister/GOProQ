import React from 'react';
import { Paper, PaperProps } from '@mui/material';
import Draggable from 'react-draggable';

interface PaperComponentProps extends PaperProps {
  children?: React.ReactNode;
}

export function PaperComponent(props: PaperComponentProps) {
  return (
    <Draggable
      handle="#draggable-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper {...props} />
    </Draggable>
  );
}
