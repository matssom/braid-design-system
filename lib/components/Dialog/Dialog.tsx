import React, {
  ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
  forwardRef,
  Fragment,
  useContext,
  Reducer,
  useReducer,
} from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { useStyles } from 'sku/react-treat';
import { hideOthers as ariaHideOthers } from 'aria-hidden';
import assert from 'assert';
import { Box } from '../Box/Box';
import { ClearButton } from '../iconButtons/ClearButton/ClearButton';
import { normalizeKey } from '../private/normalizeKey';
import { Heading } from '../Heading/Heading';
import { Stack } from '../Stack/Stack';
import { Columns } from '../Columns/Columns';
import { Column } from '../Column/Column';
import { ContentBlock, ContentBlockProps } from '../ContentBlock/ContentBlock';
import { Overlay } from '../private/Overlay/Overlay';
import { ReactNodeNoStrings } from '../private/ReactNodeNoStrings';
import { HideFocusRingsRoot } from '../private/hideFocusRings/hideFocusRings';
import { useIsolatedScroll } from '../../hooks/useIsolatedScroll/useIsolatedScroll';
import * as styleRefs from './Dialog.treat';

type Action = 'OPEN' | 'CLOSE' | 'ANIMATION_COMPLETE';
interface State {
  state: 'INITIAL' | 'OPEN' | 'OPENING' | 'CLOSED' | 'CLOSING';
}

const reducer: Reducer<State, Action> = (prevState, action) => {
  switch (action) {
    case 'OPEN': {
      switch (prevState.state) {
        case 'INITIAL':
        case 'CLOSING':
        case 'CLOSED': {
          return {
            state: 'OPENING',
          };
        }
      }
    }

    case 'CLOSE': {
      switch (prevState.state) {
        case 'OPEN':
        case 'OPENING': {
          return {
            state: 'CLOSING',
          };
        }
      }
    }

    case 'ANIMATION_COMPLETE': {
      switch (prevState.state) {
        case 'CLOSING': {
          return {
            state: 'CLOSED',
          };
        }

        case 'OPENING': {
          return {
            state: 'OPEN',
          };
        }
      }
    }
  }

  return prevState;
};

export interface DialogProps {
  id: string;
  title: string;
  children: ReactNode;
  open: boolean;
  onClose: (open: boolean) => void;
  closeLabel?: string;
  width?: ContentBlockProps['width'] | 'content';
  description?: ReactNodeNoStrings;
  illustration?: ReactNodeNoStrings;
}

const DialogContext = createContext(false);

interface DialogPortalProps {
  children: ReactNode;
}
const DialogPortal = ({ children }: DialogPortalProps) => {
  const [dialogElement, setElement] = useState<HTMLElement | null>(null);
  const dialogContext = useContext(DialogContext);

  assert(!dialogContext, 'Nested Dialogs are not supported.');

  useEffect(() => {
    const dialogContainerId = 'braid-dialog-container';
    let element = document.getElementById(dialogContainerId);

    if (!element) {
      element = document.createElement('div');
      element.setAttribute('id', dialogContainerId);
      element.setAttribute('class', '');

      document.body.appendChild(element);
    }

    setElement(element);
  }, []);

  if (!dialogElement) {
    return null;
  }

  return createPortal(
    <DialogContext.Provider value={true}>{children}</DialogContext.Provider>,
    dialogElement,
  );
};

const dialogPadding = ['gutter', 'large'] as const;

interface HeaderProps extends Pick<DialogProps, 'description'> {
  title: string;
  titleId: string;
  descriptionId: string;
  center?: boolean;
}
const DialogHeader = forwardRef<HTMLElement, HeaderProps>(
  ({ title, titleId, description, descriptionId, center }, ref) => {
    const styles = useStyles(styleRefs);

    return (
      <Stack space="medium">
        <Heading level="3" id={titleId} align={center ? 'center' : undefined}>
          <Box
            ref={ref}
            component="span"
            tabIndex={-1}
            outline="none"
            position="relative"
            className={styles.heading}
          >
            {title}
            <Overlay
              boxShadow="outlineFocus"
              borderRadius="standard"
              transition="fast"
              className={styles.heading}
              onlyVisibleForKeyboardNavigation
            />
          </Box>
        </Heading>
        {description ? <Box id={descriptionId}>{description}</Box> : null}
      </Stack>
    );
  },
);

const Container = ({
  children,
  width,
}: {
  children: ReactNode;
  width: DialogProps['width'];
}) =>
  width !== 'content' ? (
    <ContentBlock width={width}>{children}</ContentBlock>
  ) : (
    <Fragment>{children}</Fragment>
  );

const CLOSE_ANIMATION_DURATION = 200;
export const Dialog = ({
  id,
  open,
  children,
  description,
  onClose,
  width = 'small',
  closeLabel = 'Close',
  illustration,
  title,
}: DialogProps) => {
  const styles = useStyles(styleRefs);
  const [trapActive, setTrapActive] = useState(true);
  const [{ state }, dispatch] = useReducer(reducer, { state: 'INITIAL' });

  const dialogRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLElement>(null);
  const closeHandlerRef = useRef<DialogProps['onClose']>(onClose);
  const openRef = useRef<boolean>(open);

  const labelId = `${id}_label`;
  const descriptionId = `${id}_desc`;

  useEffect(() => {
    openRef.current = open;
    dispatch(open ? 'OPEN' : 'CLOSE');
  }, [open]);

  useEffect(() => {
    if (state === 'CLOSING' || state === 'OPENING') {
      const timer = setTimeout(() => {
        dispatch('ANIMATION_COMPLETE');
      }, CLOSE_ANIMATION_DURATION);

      return () => clearTimeout(timer);
    }

    if (state === 'OPEN' && dialogRef.current) {
      return ariaHideOthers(dialogRef.current);
    }
  }, [state]);

  useEffect(() => {
    if (typeof onClose === 'function') {
      closeHandlerRef.current = onClose;
    }
  }, [onClose]);

  useEffect(() => {
    if (state === 'CLOSED' && openRef.current) {
      closeHandlerRef.current(false);
    }
  }, [state]);

  useIsolatedScroll(dialogRef.current);
  useIsolatedScroll(backdropRef.current);

  const initiateClose = () => dispatch('CLOSE');

  const handleEscape = useCallback((event) => {
    const targetKey = normalizeKey(event);
    if (targetKey === 'Escape') {
      event.stopPropagation();
      dispatch('CLOSE');
    }
  }, []);

  useEffect(() => {
    const event = trapActive ? 'blur' : 'focus';
    const handleEvent = () => setTrapActive(!trapActive);

    window.addEventListener(event, handleEvent);

    return () => {
      window.removeEventListener(event, handleEvent);
    };
  }, [trapActive]);

  return (
    <DialogPortal>
      {state === 'OPENING' || state === 'OPEN' || state === 'CLOSING' ? (
        <FocusLock
          disabled={!trapActive}
          onActivation={() => {
            if (headingRef.current) {
              headingRef.current.focus();
            }
          }}
          returnFocus
        >
          <HideFocusRingsRoot>
            <Box
              ref={backdropRef}
              onClick={initiateClose}
              position="fixed"
              top={0}
              bottom={0}
              left={0}
              right={0}
              zIndex="modalBackdrop"
              transition="fast"
              opacity={state !== 'OPEN' ? 0 : undefined}
              className={styles.backdrop}
            />

            <Box
              position="fixed"
              top={0}
              bottom={0}
              left={0}
              right={0}
              zIndex="modal"
              display="flex"
              alignItems="center"
              justifyContent="center"
              pointerEvents="none"
              transition="fast"
              opacity={state !== 'OPEN' ? 0 : undefined}
              padding={['xxsmall', 'gutter', 'xlarge']}
              className={[
                styles.dialogContainer,
                state !== 'OPEN' && styles.closed,
              ]}
            >
              <Container width={width}>
                <Box
                  ref={dialogRef}
                  role="dialog"
                  aria-labelledby={labelId}
                  aria-describedby={description ? descriptionId : undefined}
                  aria-modal="true"
                  onKeyDown={handleEscape}
                  background="card"
                  borderRadius="standard"
                  overflow="auto"
                  position="relative"
                  boxShadow="large"
                  width={width !== 'content' ? 'full' : undefined}
                  padding={dialogPadding}
                  className={styles.dialogContent}
                >
                  <Stack space="large">
                    {illustration ? (
                      <Stack space="medium" align="center">
                        <Box paddingX="gutter">{illustration}</Box>
                        <DialogHeader
                          title={title}
                          titleId={labelId}
                          description={description}
                          descriptionId={descriptionId}
                          center={Boolean(illustration)}
                          ref={headingRef}
                        />
                      </Stack>
                    ) : (
                      <Columns space={dialogPadding}>
                        <Column>
                          <DialogHeader
                            title={title}
                            titleId={labelId}
                            description={description}
                            descriptionId={descriptionId}
                            center={Boolean(illustration)}
                            ref={headingRef}
                          />
                        </Column>
                        <Column width="content">
                          <Box className={styles.closePlaceholder} />
                        </Column>
                      </Columns>
                    )}
                    <Fragment>{children}</Fragment>
                  </Stack>

                  <Box
                    position="absolute"
                    top={0}
                    right={0}
                    paddingTop={dialogPadding}
                    paddingRight={dialogPadding}
                  >
                    <Box className={styles.closeOffset}>
                      <ClearButton
                        tone="neutral"
                        label={closeLabel}
                        onClick={initiateClose}
                      />
                    </Box>
                  </Box>
                </Box>
              </Container>
            </Box>
          </HideFocusRingsRoot>
        </FocusLock>
      ) : null}
    </DialogPortal>
  );
};
