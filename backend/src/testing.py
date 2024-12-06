from ocpa.objects.log.importer.csv import factory as ocel_import_factory
import pandas as pd

if __name__ == '__main__':
    filename = "../data/export2.csv"

    parameters = {
        "obj_names": ["e.Order_Details", "e.SupplierOrder", "e.Order", "e.Item", "e.Invoice", "e.Payment", "e.Actor"],
        "val_names": [],
        "act_name": "e.Activity",
        "time_name": "e.timestamp",
        "sep": ",",
        "execution_extraction": "leading_type",  # connected_components
        "leading_type": "e.Order",
        "variant_calculation": "two_phase",
        "exact_variant_calculation": True
    }

    ocel = ocel_import_factory.apply(file_path=filename, parameters=parameters)
    print(ocel)

    print("Number of process executions: " + str(len(ocel.process_executions)))
    print("Events of the first process execution: " + str(ocel.process_executions[0]))
    print("Objects of the first process execution: " + str(ocel.process_execution_objects[0]))
    print("Process execution graph of the first execution:")
    print(ocel.get_process_execution_graph(0))
    print("Process execution of the first event with event id 0: " + str(ocel.process_execution_mappings[0]))

    #df = pd.read_csv("../data/BPI2017-Final.csv")
    #print(df.dtypes)
    df = pd.read_csv("../data/filter_variant.csv")
    df.drop(["event_start_timestamp"], axis=1, inplace=True)
    df.to_csv("../data/filter_variant_filtered.csv", index=None)
    #df[:150000].to_csv("../data/BPI2017-Final_large.csv", index=None)
