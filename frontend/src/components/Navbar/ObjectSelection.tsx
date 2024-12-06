import "./ObjectSelection.css"
import {
    faBox,
    faBoxesStacked,

} from "@fortawesome/free-solid-svg-icons";
import {useEffect} from "react";
import {faCircle} from "@fortawesome/free-regular-svg-icons";
import {getObjectTypeColor} from "../utils";
import {NavbarDropdown} from "./NavbarDropdown";
import {DropdownCheckbox} from "./DropdownCheckbox";

type ObjectSelectionProps = {
    // all available object types in the currently visualized dfm (empty list means object types have not been determined  yet)
    availableObjectTypes: string[],
    // all currently selected object types (needs to be passed in at least for initialization, e.g. when restoring a session)
    selectedObjectTypes: string[],
    // should we select all object types at the start of visualizing a new dfm?
    selectAllObjectTypesInitially: boolean,
    // have we already selected all object types for this dfm?
    alreadySelectedAllObjectTypesInitially: boolean,
    setSelectedObjectTypes: (selectedObjectTypes: string[]) => void
}

export const ObjectSelection = (props: ObjectSelectionProps) => {
    useEffect(() => {
        if (
            !props.alreadySelectedAllObjectTypesInitially
            && props.availableObjectTypes.length > 0
            && props.selectAllObjectTypesInitially
        ) {
            props.setSelectedObjectTypes(props.availableObjectTypes);
        }
    });

    const toggleObjectType = (objectType: string) => {
        const newSelection = props.selectedObjectTypes.map((x) => x);
        const index = newSelection.indexOf(objectType);
        if (index !== -1)
            newSelection.splice(index, 1);
        else
            newSelection.push(objectType);

        if (newSelection.length > 0)
            props.setSelectedObjectTypes(newSelection);
    }

    const selectOnlyObjectType = (objectType: string) => {
        props.setSelectedObjectTypes([objectType]);
    }

    const selectAllObjectTypes = () => {
        props.setSelectedObjectTypes(props.availableObjectTypes);
    }

    const isOnlyObjectType = (objectType: string) =>
        props.selectedObjectTypes.length === 1 && props.selectedObjectTypes[0] === objectType;

    const selectionCount = props.selectedObjectTypes.length;
    const countIcon = selectionCount === 0 ? faCircle : (selectionCount === 1 ? faBox : faBoxesStacked);

    const totalNumberOfObjectTypes = props.availableObjectTypes.length;

    return (
        <NavbarDropdown buttonIcon={countIcon} buttonText="Objects">
            <div className="NOS-ObjectType NOS-ObjectType-SelectAll" onClick={() => selectAllObjectTypes()}>
                Select all
            </div>
            {props.availableObjectTypes.map((objectType, index) => {
                const otColor = getObjectTypeColor(totalNumberOfObjectTypes, index);
                const onlyOT = isOnlyObjectType(objectType);
                return (
                    <DropdownCheckbox key={`SelectionToggle-${objectType}`}
                                      label={objectType}
                                      selected={props.selectedObjectTypes.includes(objectType)}
                                      checkColor={otColor}
                                      disabled={onlyOT}
                                      title={onlyOT ?
                                          "At least one object type has to be selected at all times. Please select another object type first to unselect this object time." :
                                          "Double-click to de-select all but one."}

                                      onClick={() => toggleObjectType(objectType)}
                                      onDoubleClick={() => selectOnlyObjectType(objectType)}/>
                )
            })}
        </NavbarDropdown>
    )
}