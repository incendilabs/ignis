import {
  Dialog as AriaDialog,
  Modal,
  ModalOverlay,
  type DialogProps as AriaDialogProps,
  type ModalOverlayProps,
} from "react-aria-components";
import { Button } from "../button";

interface DialogProps extends AriaDialogProps {
  title?: string;
  children: React.ReactNode;
}

interface ModalDialogProps extends ModalOverlayProps {
  title?: string;
  children: React.ReactNode;
}

export function Dialog({ title, children, ...props }: DialogProps) {
  return (
    <AriaDialog {...props} className="outline-none relative">
      {({ close }) => (
        <>
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h2>
              <Button
                variant="ghost"
                onPress={close}
                aria-label="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          )}
          {children}
        </>
      )}
    </AriaDialog>
  );
}

export function ModalDialog({
  title,
  children,
  ...props
}: ModalDialogProps) {
  return (
    <ModalOverlay
      {...props}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
    >
      <Modal className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-auto p-6">
        <Dialog title={title}>{children}</Dialog>
      </Modal>
    </ModalOverlay>
  );
}
