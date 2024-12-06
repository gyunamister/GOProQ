import './NavbarDropdown.css'
import {forwardRef, Ref, useImperativeHandle, useState} from "react";
import {useDelayedExecution} from "../utils";
import {NavbarButton} from "./NavbarButton";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {IconDefinition} from "@fortawesome/free-regular-svg-icons";
import {faCaretDown, faCaretUp} from "@fortawesome/free-solid-svg-icons";

type NavbarDropdownProps = {
    buttonIcon?: IconDefinition,
    buttonText: string,
    children?: any
}

export interface NavbarDropdownMethods {
    close(): void
}

export const NavbarDropdown = forwardRef((props: NavbarDropdownProps, ref: Ref<NavbarDropdownMethods | undefined>) => {
    const [open, setOpen] = useState<boolean>(false);
    const delayedClose = useDelayedExecution(() => setOpen(false), 300);

    useImperativeHandle(ref, () => ({
        close() {
            setOpen(false);
        }
    }));

    const dropdownIcon = open ? faCaretUp : faCaretDown;

    return (
        <div className="NavbarDropdown-Container"
             onMouseLeave={() => delayedClose.execute()}
             onMouseEnter={() => delayedClose.cancel()}>
            <div className={`NavbarDropdown-ButtonWrapper ${open ? 'NavbarDropdown-ButtonWrapper--open' : ''}`}>
                <NavbarButton icon={props.buttonIcon}
                              active={open}
                              onClick={() => setOpen(!open)}>
                    { props.buttonText }
                    <FontAwesomeIcon icon={dropdownIcon} className="NavbarDropdown-Button-DropdownIcon"/>
                </NavbarButton>
            </div>

            {open && (
                <div className="NavbarDropdown-Dropdown">
                    { props.children }
                </div>
            )}
        </div>
    )
});