import { IsDefined, IsInt, IsDate } from "class-validator";
import { Vue, Tag } from "./";

export class TagsOnVue {
    @IsDefined()
    vue!: Vue;

    @IsDefined()
    tags!: Tag[];

    @IsDefined()
    @IsInt()
    vueId!: number;

    @IsDefined()
    @IsDate()
    assignedAt!: Date;
}
