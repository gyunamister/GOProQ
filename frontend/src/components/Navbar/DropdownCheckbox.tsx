import './DropdownCheckbox.css';
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faCircleCheck} from "@fortawesome/free-solid-svg-icons";
import {faCircle} from "@fortawesome/free-regular-svg-icons";
import {MouseEventHandler} from "react";
import {IconProp} from "@fortawesome/fontawesome-svg-core";

type DropdownCheckboxProps = {
    selected: boolean,
    label: string,
    disabled?: boolean
    checkColor?: string

    onClick?: MouseEventHandler<HTMLDivElement>,
    onDoubleClick?: MouseEventHandler<HTMLDivElement>
    title?: string
}

export const DropdownCheckbox = (props: DropdownCheckboxProps) => {
    return (
        <div
            onClick={props.onClick}
            onDoubleClick={props.onDoubleClick}
            className={`NavbarDropdown-Checkbox ${props.disabled ? 'NavbarDropdown-Checkbox--disabled' : ''}`}
            title={props.title}>
            <FontAwesomeIcon
                icon={props.selected ? faCircleCheck as IconProp : faCircle as IconProp}
                className="NavbarDropdown-Checkbox-Check" style={{color: props.checkColor || 'rgb(var(--color1))'}}/>
            {props.label}
        </div>)
}